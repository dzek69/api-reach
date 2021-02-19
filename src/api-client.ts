/* eslint-disable max-lines */
import f from "light-isomorphic-fetch";
import qs from "qs";
import urlJoin from "url-join";
// eslint-disable-next-line @typescript-eslint/no-shadow
import AbortController from "isomorphic-abort-controller";
import { Timeout } from "oop-timers";

import { ClientHttpError, ServerHttpError, ResponseDataTypeMismatchError, AbortedHttpError, TimeoutHttpError }
    from "./errors.js";
import type { PossibleNonErrorResponses } from "./response/response.js";
import { ClientErrorResponse, createResponse, ServerErrorResponse } from "./response/response.js";
import type {
    AbortErrorDetails,
    AbortErrorObject,
    Data,
    FetchOptions,
    Options,
    URLArgument,
    BodyArgument,
    AbortablePromise,
    ConfigureOptions,
} from "./types";
import { contentTypeMap, RequestType } from "./const.js";
import { getJoinedUrl, wait } from "./helpers.js";
import { ApiRequest } from "./request/request.js";

const stringify = qs.stringify;
// @ts-expect-error see todo - it's needed for max compatibility
const fetch = (f.default || f) as typeof f; // @todo verify if it's needed for stable v3 of node-fetch when its released

let URLParser = URL;

const safeUrlParse = (url?: string) => {
    try {
        return new URLParser(url!);
    }
    catch (e: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
        return null;
    }
};

const globalOptions: Required<Omit<Options, "base" | "headers">> = { // eslint-disable-line object-shorthand
    type: RequestType.json,
    retry: 1,
    retryInterval: 100,
    retryPolicy({ count }) {
        return count <= this.retry;
    },
    retryWaitPolicy() {
        return this.retryInterval;
    },
    timeout: 30000,
    totalTimeout: 60000,
};

const noop = () => undefined;

const createAbortError = ({ isTimeouted, isGlobalTimeouted, lastError, errorDetails }: AbortErrorObject) => {
    const useTimeoutError = isTimeouted || isGlobalTimeouted;
    if (useTimeoutError) {
        // @TODO do something with errorDetails typecasting
        return new TimeoutHttpError(`Request aborted because of timeout`, lastError, errorDetails as unknown as Data);
    }
    return new AbortedHttpError(`Request aborted`, lastError, errorDetails as unknown as Data);
};

class ApiClient {
    private readonly _options: Options;

    /**
     * @class ApiClient
     * @param {Options} options - options that will override defaults
     */
    public constructor(options?: Options) {
        this._options = options ?? {};
    }

    private _getType(options: Options): NonNullable<Options["type"]> {
        return options.type ?? this._options.type ?? RequestType.json;
    }

    private _getContentType(options: Options) {
        const type = this._getType(options);
        return contentTypeMap[type]; // @todo handle unknown type
    }

    private _getBody(options: Options, body?: BodyArgument) {
        const type = this._getType(options);
        if (type === RequestType.json) {
            return JSON.stringify(body);
        }
        if (type === RequestType.text) {
            if (typeof body === "string") {
                return body;
            }
            return stringify(body);
        }
        return ""; // @todo throw?
    }

    private _buildFetchOptions(options: Options, method: FetchOptions["method"], body?: BodyArgument): FetchOptions {
        const globalHeaders = this._options.headers;
        const localHeaders = options.headers;

        const contentType: { "Content-Type"?: string | null } = {};
        const bodyOptions: { body?: string } = {};
        if (body != null) {
            contentType["Content-Type"] = this._getContentType(options);
            bodyOptions.body = this._getBody(options, body);
        }

        return { // @todo filter only known options
            ...globalOptions,
            ...this._options,
            ...options,
            ...bodyOptions,
            method: method,
            headers: {
                ...globalHeaders, // @todo handle same header but with different case
                ...localHeaders, // @todo handle multiple headers
                ...contentType,
            },
        };
    }

    private _buildUrlBase(url: string | string[], base?: string) {
        const parsedBase = safeUrlParse(base);
        if (!parsedBase?.host) {
            // if no base is given - just use the url
            return getJoinedUrl(url);
        }

        // base is defined at this point
        const parsedUrl = safeUrlParse(getJoinedUrl(url));
        if (parsedUrl) { // base is valid full url and given url is also full url
            throw new Error("Cannot use absolute url with base url."); // @todo throw custom type?
        }

        return urlJoin(base!, getJoinedUrl(url));
    }

    private _buildUrl(originalUrl: URLArgument, queryParams: Data, fetchOptions: FetchOptions) {
        const url = this._buildUrlBase(originalUrl, fetchOptions.base);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!queryParams) {
            return url;
        }
        const hasQS = url.includes("?");
        const appendChar = hasQS ? "&" : "?";
        // @todo extract existing query params from string and include for stringify ?
        // @todo add support for string query params

        return url + appendChar + stringify(queryParams);
    }

    /**
     * Sends a GET request
     *
     * @param {string} url - absolute url or relative that will be joined with base url
     * @param {Object|null} [queryParams] - query params that will be added to `url`
     * @param {Options} [options] - options that will override defaults and options specified in the constructor
     * @returns {Promise<Response>}
     * @throws {ClientHttpError}
     * @throws {ServerHttpError}
     * @throws {ResponseDataTypeMismatchError}
     * @throws {AbortedHttpError}
     * @throws {TimeoutHttpError}
     * @throws {Error}
     */
    public async get<T>(url: URLArgument, queryParams: Data, options: Options) {
        return this.request<T>("GET", url, queryParams, null, options);
    }

    /**
     * Sends a POST request
     *
     * @param {string} url - absolute url or relative that will be joined with base url
     * @param {Object|null} [queryParams] - query params that will be added to `url`
     * @param {string|Object} [body] - request body. Used as-is when string or stringified according to given data
     * `type` when Object
     * @param {Options} [options] - options that will override defaults and options specified in the constructor
     * @returns {Promise<Response>}
     * @throws {ClientHttpError}
     * @throws {ServerHttpError}
     * @throws {ResponseDataTypeMismatchError}
     * @throws {AbortedHttpError}
     * @throws {TimeoutHttpError}
     * @throws {Error}
     */
    public async post<T>(url: URLArgument, queryParams: Data, body: BodyArgument, options: Options) {
        return this.request<T>("POST", url, queryParams, body, options);
    }

    /**
     * Sends a PATCH request
     *
     * @param {string} url - absolute url or relative that will be joined with base url
     * @param {Object|null} [queryParams] - query params that will be added to `url`
     * @param {string|Object} [body] - request body. Used as-is when string or stringified according to given data
     * `type` when Object
     * @param {Options} [options] - options that will override defaults and options specified in the constructor
     * @returns {Promise<Response>}
     * @throws {ClientHttpError}
     * @throws {ServerHttpError}
     * @throws {ResponseDataTypeMismatchError}
     * @throws {AbortedHttpError}
     * @throws {TimeoutHttpError}
     * @throws {Error}
     */
    public async patch<T>(url: URLArgument, queryParams: Data, body: BodyArgument, options: Options) {
        return this.request<T>("PATCH", url, queryParams, body, options);
    }

    /**
     * Sends a DELETE request
     *
     * @param {string} url - absolute url or relative that will be joined with base url
     * @param {Object|null} [queryParams] - query params that will be added to `url`
     * @param {string|Object} [body] - request body. Used as-is when string or stringified according to given data
     * `type` when Object
     * @param {Options} [options] - options that will override defaults and options specified in the constructor
     * @returns {Promise<Response>}
     * @throws {ClientHttpError}
     * @throws {ServerHttpError}
     * @throws {ResponseDataTypeMismatchError}
     * @throws {AbortedHttpError}
     * @throws {TimeoutHttpError}
     * @throws {Error}
     */
    public async delete<T>(url: URLArgument, queryParams: Data, body: BodyArgument, options: Options) {
        return this.request<T>("DELETE", url, queryParams, body, options);
    }

    /**
     * Sends a HEAD request
     *
     * @param {string} url - absolute url or relative that will be joined with base url
     * @param {Object|null} [queryParams] - query params that will be added to `url`
     * @param {string|Object} [body] - request body. Used as-is when string or stringified according to given data
     * `type` when Object
     * @param {Options} [options] - options that will override defaults and options specified in the constructor
     * @returns {Promise<Response>}
     * @throws {ClientHttpError}
     * @throws {ServerHttpError}
     * @throws {ResponseDataTypeMismatchError}
     * @throws {AbortedHttpError}
     * @throws {TimeoutHttpError}
     * @throws {Error}
     */
    public async head<T>(url: URLArgument, queryParams: Data, body: BodyArgument, options: Options) {
        return this.request<T>("HEAD", url, queryParams, body, options);
    }

    /**
     * Sends a custom method request
     *
     * @param {string} method - method to use
     * @param {string} url - absolute url or relative that will be joined with base url
     * @param {Object|null} [queryParams] - query params that will be added to `url`
     * @param {string|Object} [body] - request body. Used as-is when string or stringified according to given data
     * `type` when Object
     * @param {Options} [options] - options that will override defaults and options specified in the constructor
     * @returns {Promise<Response>}
     * @throws {ClientHttpError}
     * @throws {ServerHttpError}
     * @throws {ResponseDataTypeMismatchError}
     * @throws {AbortedHttpError}
     * @throws {TimeoutHttpError}
     * @throws {Error}
     */
    public request<T = unknown>(method: string, url: URLArgument, queryParams: Data, body: BodyArgument, options: Options | null = {}) { // eslint-disable-line max-lines-per-function, max-len
        const start = Date.now();
        const fineOptions = this._buildFetchOptions(options ?? {}, method, body);
        let currentController: AbortController,
            globalTimeout: Timeout,
            aborted = false,
            isGlobalTimeouted = false;

        const globalBreak = () => {
            isGlobalTimeouted = true;
            future.abort!(); // eslint-disable-line @typescript-eslint/no-use-before-define
        };

        const future: AbortablePromise<PossibleNonErrorResponses> = new Promise((resolve, reject) => { // eslint-disable-line max-lines-per-function, max-len
            let count = 0,
                lastError = null;

            (async () => { // eslint-disable-line max-statements
                while (fineOptions.retryPolicy({ count: ++count })) {
                    let isTimeouted = false;
                    currentController = new AbortController();
                    const singleTimeout = new Timeout(() => { // eslint-disable-line @typescript-eslint/no-loop-func
                        isTimeouted = true;
                        currentController.abort();
                    }, fineOptions.timeout);
                    try {
                        if (count > 1) {
                            const waitTime = fineOptions.retryWaitPolicy({ count });
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                            if (!globalTimeout || fineOptions.totalTimeout > (Date.now() - start) + waitTime) {
                                await wait(waitTime);
                            }
                            else {
                                globalTimeout.stop();
                                globalBreak();
                            }
                        }
                        if (aborted) {
                            const errorDetails: AbortErrorDetails = {
                                tries: count - 1,
                                while: "waiting",
                                timeout: isTimeouted,
                                globalTimeout: isGlobalTimeouted,
                            };

                            lastError = createAbortError({ isTimeouted, isGlobalTimeouted, lastError, errorDetails });
                            break;
                        }
                        singleTimeout.start();

                        return await this._request<T>(
                            url, queryParams, fineOptions, currentController.signal,
                        );
                    }
                    catch (e: unknown) {
                        if ((e as Error).name === "AbortError") {
                            const errorDetails: AbortErrorDetails = {
                                tries: count,
                                while: "connection",
                                timeout: isTimeouted,
                                globalTimeout: isGlobalTimeouted,
                            };
                            lastError = createAbortError({ isTimeouted, isGlobalTimeouted, lastError, errorDetails });
                            // it should not try again if:
                            // globally timeouted
                            // aborted by user (abort didn't happened via timeout)
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                            if (isGlobalTimeouted || !isTimeouted) {
                                break;
                            }
                            continue;
                        }
                        lastError = e as Error;
                    }
                    finally {
                        singleTimeout.stop();
                    }
                }
                throw lastError ? lastError : new Error("No error thrown"); // @todo what to do if no error saved?
            })().then(resolve, reject);
        });
        future.finally(() => {
            globalTimeout.stop();
        }).catch(noop); // noop is required here, as finally is creating new promise branch and throws if errors occurs
        // and each branch should handle error separately (even if that is the same error)

        future.abort = () => {
            aborted = true;
            currentController.abort();
        };

        if (fineOptions.totalTimeout > 0 && Number.isFinite(fineOptions.totalTimeout)) {
            globalTimeout = new Timeout(globalBreak, fineOptions.totalTimeout, true);
        }

        return future;
    }

    private async _request<T>(
        originalUrl: URLArgument,
        queryParams: Data,
        options: FetchOptions,
        signal: AbortSignal,
    ): Promise<PossibleNonErrorResponses> {
        const fetchOptions = options;

        const url = this._buildUrl(originalUrl, queryParams, fetchOptions);

        const request = new ApiRequest(url, fetchOptions, originalUrl, queryParams);

        const result = (await fetch(request.url, {
            ...request.options,
            // @ts-expect-error random incompatibilities, @TODO fix it
            signal,
        }));

        const type = this._getType(options);

        const response = await createResponse<T>(result, type, request);
        if ("rawBody" in response) {
            throw new ResponseDataTypeMismatchError("Unexpected type of data received", {
                response: response,
                expectedType: type,
            });
        }

        if (response instanceof ClientErrorResponse) {
            throw new ClientHttpError(result.statusText, {
                response,
            });
        }
        if (response instanceof ServerErrorResponse) {
            throw new ServerHttpError(result.statusText, {
                response,
            });
        }

        return response;
    }
}

/**
 * Sets global ApiClient configuration that is shared between instances
 *
 * @param {ConfigureOptions} options
 * @param {function} options.URL - `URL`-compatible URL parser, see: https://is.gd/Wbyu4k and https://is.gd/FziUWo
 */
const configure = (options: ConfigureOptions) => {
    URLParser = options.URL;
};

export { ApiClient, configure };
