/* eslint-disable max-lines */
// eslint-disable-next-line @typescript-eslint/no-shadow
import f, { Headers } from "light-isomorphic-fetch";
import qs from "qs";
import urlJoin from "url-join";
// eslint-disable-next-line @typescript-eslint/no-shadow
import AbortController from "isomorphic-abort-controller";
import { Timeout } from "oop-timers";
import hasher from "node-object-hash";

import type { CustomError } from "better-custom-error";
import type { Response as NodeFetchResponse } from "node-fetch";

import type {
    AbortErrorDetails,
    AbortErrorObject,
    Data,
    FetchOptions,
    Options,
    URLArgument,
    BodyArgument,
    AbortablePromise,
    ConfigureOptions, ParsedResponse, ParsedError, PossibleCustomErrorsThrown,
    ResponseData,
} from "./types";
import type { PossibleNonErrorResponses, PossibleResponses } from "./response/response.js";

import type {
    ErrorDetails,
} from "./errors.js";
import {
    ClientHttpError,
    ServerHttpError,
    ResponseDataTypeMismatchError,
    AbortedHttpError,
    TimeoutHttpError,
}
    from "./errors.js";
import {
    ClientErrorResponse,
    createResponse,
    createResponseWithData,
    ServerErrorResponse,
} from "./response/response.js";
import { contentTypeMap, RequestType } from "./const.js";
import { getJoinedUrl, wait } from "./helpers.js";
import { ApiRequest } from "./request/request.js";

const stringify = qs.stringify;
// @ts-expect-error see todo - it's needed for max compatibility -- todo maybe not needed anymore?
const fetch = (f.default || f) as typeof f; // @todo verify if it's needed for stable v3 of node-fetch when its released

let URLParser = URL;
// eslint-disable-next-line @typescript-eslint/unbound-method
const { hash: ohash } = hasher({ sort: true, coerce: false });

// @TODO add hash support, currently it's a bit broken, test.com/?t=true#test { x: false } will append query after hash!

const safeUrlParse = (url?: string) => {
    try {
        return new URLParser(url!);
    }
    catch (e: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
        return null;
    }
};

// eslint-disable-next-line object-shorthand
const defaultOptions: Required<Omit<Options, "base" | "fetchOptions">> = {
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
    cache: null,
    cacheKey: (req) => {
        if (req.method.toLowerCase() !== "get") {
            return;
        }
        return ohash(req);
    },
    shouldCacheResponse: (response) => {
        if (!(response instanceof Error)) { // any non error can be cached
            return true;
        }
        if ((response.details?.response as PossibleResponses) instanceof ClientErrorResponse) {
            // client error can be cached
            return true;
        }
        return false;
    },
};

const noop = () => undefined;

const createAbortError = ({ isTimeouted, isGlobalTimeouted, lastError, errorDetails }: AbortErrorObject) => {
    const useTimeoutError = isTimeouted || isGlobalTimeouted;
    if (useTimeoutError) {
        return new TimeoutHttpError(`Request aborted because of timeout`, lastError, errorDetails);
    }
    return new AbortedHttpError(`Request aborted`, lastError, errorDetails);
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
        return contentTypeMap[type]; // @todo handle unknown type on runtime?
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

    private _buildFetchOptions(
        options: Options, method: FetchOptions["fetchOptions"]["method"], body?: BodyArgument,
    ): FetchOptions {
        const instanceHeaders = this._options.fetchOptions?.headers;
        const localHeaders = options.fetchOptions?.headers;

        const contentType: { "Content-Type"?: string | null } = {};
        const bodyOptions: { body?: string } = {};
        if (body != null) {
            contentType["Content-Type"] = this._getContentType(options);
            bodyOptions.body = this._getBody(options, body);
        }

        const opts: FetchOptions = { // @todo filter only known options
            ...defaultOptions,
            ...this._options,
            ...options,
            fetchOptions: {
                ...bodyOptions,
                method: method,
                headers: {
                    ...instanceHeaders, // @todo handle same header but with different case
                    ...localHeaders, // @todo handle multiple headers
                    ...contentType,
                },
            },
        };

        Object.defineProperty(opts, "toJSON", {
            value: () => ({ type: opts.type }),
        });

        return opts;
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

    private _buildUrl(originalUrl: URLArgument, queryParams: Data | null | undefined, fetchOptions: FetchOptions) {
        const url = this._buildUrlBase(originalUrl, fetchOptions.base);
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
    public async get<T>(url: URLArgument, queryParams?: Data | null, options?: Options | null) {
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
    public async post<T>(
        url: URLArgument, queryParams?: Data | null, body?: BodyArgument, options?: Options | null,
    ) {
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
    public async patch<T>(
        url: URLArgument, queryParams?: Data | null, body?: BodyArgument, options?: Options | null,
    ) {
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
    public async delete<T>(url: URLArgument, queryParams?: Data | null, body?: BodyArgument, options?: Options | null) {
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
    public async head<T>(
        url: URLArgument, queryParams?: Data | null, body?: BodyArgument, options?: Options | null,
    ) {
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
     * @returns {Promise<PossibleNonErrorResponses>}
     * @throws {ClientHttpError}
     * @throws {ServerHttpError}
     * @throws {ResponseDataTypeMismatchError}
     * @throws {AbortedHttpError}
     * @throws {TimeoutHttpError}
     * @throws {Error}
     */
    public request<T = unknown>(method: string, url: URLArgument, queryParams?: Data | null, body?: BodyArgument, options: Options | null = {}) { // eslint-disable-line max-lines-per-function, max-len
        const start = Date.now();
        const fineOptions = this._buildFetchOptions(options ?? {}, method, body);
        const fullUrl = this._buildUrl(url, queryParams, fineOptions);
        const request = new ApiRequest(fullUrl, fineOptions, url, queryParams);

        let cacheKey: string | undefined = undefined,

            currentController: AbortController,
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
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (fineOptions.cache && fineOptions.cacheKey) {
                    cacheKey = fineOptions.cacheKey({
                        url: fullUrl,
                        method: request.options.fetchOptions.method,
                        headers: request.options.fetchOptions.headers,
                        body: request.options.fetchOptions.body,
                    });
                    if (cacheKey) {
                        const cachedResult = await fineOptions.cache.get(cacheKey);
                        if (cachedResult) {
                            const result = ApiClient.parseStringifiedReponse(cachedResult);
                            if (result instanceof Error) {
                                throw result;
                            }
                            return result; // @todo ts omit error responses here
                        }
                    }
                }

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

                        return await this._request<T>(request, fineOptions, currentController.signal);
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
            })().then((response) => {
                // @TODO add option to wait for cache before resolving
                resolve(response);
                if (!fineOptions.cache || !cacheKey) {
                    return;
                }
                if (fineOptions.shouldCacheResponse(response)) {
                    fineOptions.cache.set(cacheKey, ApiClient.stringifyResponse(response)).catch(noop);
                }
            }, (error: unknown) => {
                reject(error);
                if (!fineOptions.cache || !cacheKey) {
                    return;
                }
                if (fineOptions.shouldCacheResponse(error as CustomError<ErrorDetails>)) {
                    fineOptions.cache
                        .set(cacheKey, ApiClient.stringifyResponse(error as CustomError<ErrorDetails>))
                        .catch(noop);
                }
            });
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
        request: ApiRequest,
        options: FetchOptions,
        signal: AbortSignal,
    ): Promise<PossibleNonErrorResponses> {
        const result = (await fetch(request.url, {
            ...request.options.fetchOptions,
            // @ts-expect-error random incompatibilities, @TODO fix it
            signal,
        }));

        const type = this._getType(options);
        return ApiClient._serveResponse<T>(result, type, request);
    }

    private static async _serveResponse<T>(result: NodeFetchResponse, type: RequestType, request: ApiRequest) {
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

    public static stringifyResponse(
        response: PossibleResponses | PossibleCustomErrorsThrown, space?: string | number,
    ): string {
        const objToStringify = response instanceof Error
            ? {
                error: response.name,
                message: response.message,
                details: {
                    ...response.details,
                    response: response.details?.response,
                },
            }
            : response;

        return JSON.stringify(objToStringify, function replacer(key, value: unknown) {
            if (value instanceof Headers) {
                const h: { [key: string]: unknown } = {};
                Array.from(value.keys()).forEach(mapKey => {
                    h[mapKey] = value.get(mapKey);
                });
                return h;
            }
            return value;
        }, space);
    }

    // eslint-disable-next-line max-statements
    public static parseStringifiedReponse<T>(string: string) {
        const parsedData = JSON.parse(string) as ParsedResponse | ParsedError;
        const all = "error" in parsedData ? parsedData.details.response : parsedData;

        const status = all.status;
        const statusText = all.statusText;
        const headers = new Headers(all.headers);

        const request = new ApiRequest(
            all.request.url,
            // @TODO what to do with missing options after (de)serializing? types are different than runtime
            all.request.options,
            all.request.originalUrl,
            all.request.queryParams,
        );

        const body = all.body;
        const rawBody = all.rawBody;
        const type = all.type;

        const data: ResponseData<T> = {
            type, body, rawBody,
        };
        if (rawBody == null) {
            delete data.rawBody;
        }

        const response = createResponseWithData(
            { status, statusText, headers },
            type,
            request,
            data,
        );
        if (!("error" in parsedData)) {
            return response;
        }

        // @TODO return correct error type!
        const details = {
            ...parsedData.details,
            response,
        };
        // @ts-expect-error Should not return DataMismatch here? see TODO above
        // and ts is complaining because datamismatch expects `expectedType` in details?
        return new ResponseDataTypeMismatchError(parsedData.message, details);
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
