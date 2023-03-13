/* eslint-disable max-lines */
import urlJoin from "url-join";
import qs from "qs";
import { Timeout } from "oop-timers";
import { noop, omit, pick, wait } from "@ezez/utils";

import type FetchType from "node-fetch";
import type {
    AbortablePromise,
    ApiClientConfig,
    ApiEndpoints, CachedData, CacheOptions,
    FinalOptions,
    GenericBody,
    GenericHeaders, GenericParams, GenericQuery,
    Options,
    RequestData, RequestOptions,
} from "./types";
import type { AbortErrorDetails } from "./errors";
import type { ApiResponse } from "./response/response.js";

import { ClientErrorResponse, ServerErrorResponse, createResponse } from "./response/response.js";
import { contentTypeMap, ExpectedResponseBodyType, RequestBodyType } from "./const.js";
import {
    AbortError, TimeoutError, UnknownError, ResponseDataTypeMismatchError, HttpClientError, HttpServerError,
    HttpError,
} from "./errors.js";
import { ApiRequest } from "./request/request.js";

const defaultOptions: Pick<
Required<Options<ExpectedResponseBodyType, any>>,
"requestType" | "responseType" | "timeout" | "retry" | "throw"
> = {
    responseType: ExpectedResponseBodyType.json,
    requestType: RequestBodyType.json,
    timeout: 30000,
    retry: 0,
    throw: {
        onServerErrorResponses: true,
        onClientErrorResponses: true,
    },
};

class ApiClient<T extends ExpectedResponseBodyType, RL extends ApiEndpoints> {
    private readonly _options: Options<T, GenericHeaders>;

    private readonly _dependencies: { fetch: typeof FetchType };

    public constructor(options?: Options<T, GenericHeaders>) {
        this._options = options ?? {};
        this._dependencies = {
            fetch: fetch,
        };
    }

    /**
     * Returns final expected response data type
     */
    private _getResponseType<
        RT extends ExpectedResponseBodyType,
        Op extends Options<RT, any>,
    >(options: Op): ExpectedResponseBodyType {
        return options.responseType ?? this._options.responseType ?? ExpectedResponseBodyType.json;
    }

    /**
     * Returns final request data type
     */
    private _getRequestType(options: Options<any, any>): RequestBodyType {
        return options.requestType ?? this._options.requestType ?? RequestBodyType.json;
    }

    /**
     * Get request content type
     * @param options
     * @private
     */
    private _getContentType(options: Options<any, any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
        const type = this._getResponseType(options);
        return contentTypeMap[type];
    }

    /**
     * Prepares request body to send
     * @param options
     * @param body
     * @private
     */
    private _buildRequestBody<
        B extends GenericBody,
    >(options: Options<any, any>, body?: B) {
        const requestType = this._getRequestType(options);

        if (requestType === "plain" && typeof body !== "string") {
            throw new Error("Body must be a string when request type is set to plain text");
        }

        if (typeof body === "string") {
            // @TODO maybe crash if manually stringified? we have no control over the actual format anymore
            return body;
        }

        if (requestType === RequestBodyType.json) {
            return JSON.stringify(body); // @TODO plugin for custom serialization?
        }
        if (requestType === RequestBodyType.urlencoded) {
            return qs.stringify(body);
        }

        return null;
    }

    // eslint-disable-next-line max-lines-per-function,max-statements
    private _buildFetchOptions<
        RT extends ExpectedResponseBodyType,
        H extends GenericHeaders,
        M extends string,
        B extends GenericBody,
    >(options: RequestOptions<RT, H>, method: M, body?: B, headers?: H) {
        const instanceHeaders = this._options.fetchOptions?.headers ?? {};
        const requestHeaders = headers ?? {};

        const contentType: { "Content-Type"?: string } = {};
        const bodyOptions: { body?: string } = {};
        if (body != null) {
            const ct = this._getContentType(options);
            if (ct != null) {
                contentType["Content-Type"] = ct;
            }
            const bd = this._buildRequestBody(options, body);
            if (bd != null) {
                bodyOptions.body = bd;
            }
        }

        const retry = options.retry ?? this._options.retry ?? defaultOptions.retry;

        let cache: Partial<CacheOptions> | undefined = { ...this._options.cache, ...options.cache };
        if (!cache.storage) {
            cache = undefined;
        }

        const opts: FinalOptions<ExpectedResponseBodyType, NonNullable<GenericHeaders>> = {
            // @TODO filter only known options?
            ...defaultOptions,
            ...this._options,
            ...options,
            retry: { // @TODO handle retry options
                shouldRetry: ({ tryNo }) => {
                    if (typeof retry === "number") {
                        return tryNo <= retry + 1;
                    }
                    if ("count" in retry) {
                        return tryNo <= retry.count + 1;
                    }
                    return retry.shouldRetry({ tryNo });
                },
                interval: ({ tryNo }) => {
                    if (typeof retry === "number") {
                        return 0;
                    }
                    if ("count" in retry) {
                        return retry.interval;
                    }
                    return retry.interval({ tryNo });
                },
            },
            ...(cache ? { cache: cache as CacheOptions } : undefined),
            fetchOptions: {
                ...this._options.fetchOptions,
                ...options.fetchOptions,
                ...bodyOptions,
                method: method.toUpperCase(),
                headers: { // @TODO handle same header with different case
                    ...instanceHeaders, // TODO handle multiple headers with same name
                    ...requestHeaders,
                    ...contentType,
                },
            },
        };

        // Object.defineProperty(opts, "toJSON", {
        //     value: () => ({ type: opts.type }),
        // });

        return opts;
    }

    /**
     * Either correctly parses url or returns null, no throwing
     */
    private _safeUrlParse(url?: string) {
        if (!url) {
            return null;
        }

        try {
            // @TODO replace URL with deps
            return new URL(url);
        }
        catch {}

        return null;
    }

    /**
     * Builds url with base
     */
    private _buildUrlBase(url: string, base?: string) {
        const parsedBase = this._safeUrlParse(base);
        if (!parsedBase?.host) {
            // if no base is given - just use the url
            // @TODO check for full url here? throw custom, meaningful error
            // local urls crashes on node
            // but it works in browsers
            return url;
        }

        // base is defined at this point
        const parsedUrl = this._safeUrlParse(url);
        if (parsedUrl) { // base is valid full url and given url is also full url
            throw new Error("Cannot use absolute url with base url."); // @todo throw custom type?
        }

        return urlJoin(base!, url);
    }

    /**
     * Builds final URL to send request to
     */
    private _buildUrl(
        givenUrl: string, params: GenericParams, query: GenericQuery, fetchOptions: FinalOptions<any, any>,
    ) {
        // @FIXME support for params
        const fullUrl = this._buildUrlBase(givenUrl, fetchOptions.base);
        if (!query) {
            return fullUrl;
        }
        const hasQuery = fullUrl.includes("?");
        const appendChar = hasQuery ? "&" : "?";
        // @todo extract existing query params from string and include for stringify ?
        // @todo add support for string query params

        return fullUrl + appendChar + qs.stringify(query); // @TODO use stringify from deps
    }

    public get<
        U extends keyof RL["get"] & string,
        P extends RL["get"][U]["params"],
        B extends RL["get"][U]["body"],
        BT extends RL["get"][U]["bodyType"],
        Q extends RL["get"][U]["query"],
        H extends RL["get"][U]["headers"],
        D extends RequestData<P, B, BT, Q, H>,
        RB extends RL["get"][U]["response"],
        RT extends ExpectedResponseBodyType = T,
    >(
        url: U, data?: D, options?: RequestOptions<RT, H>,
    ): AbortablePromise<T extends ExpectedResponseBodyType.json
            ? ApiResponse<"get", U, P, B, BT, Q, H, RB, RT>
            : ApiResponse<"get", U, P, B, BT, Q, H, string, RT>> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return this.request("GET", url, data, options) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    public post<
        U extends keyof RL["post"] & string,
        P extends RL["post"][U]["params"],
        B extends RL["post"][U]["body"],
        BT extends RL["post"][U]["bodyType"],
        Q extends RL["post"][U]["query"],
        H extends RL["post"][U]["headers"],
        D extends RequestData<P, B, BT, Q, H>,
        RB extends RL["post"][U]["response"],
        RT extends ExpectedResponseBodyType = T,
    >(
        url: U, data?: D, options?: RequestOptions<RT, H>,
    ): AbortablePromise<T extends ExpectedResponseBodyType.json
            ? ApiResponse<"post", U, P, B, BT, Q, H, RB, RT>
            : ApiResponse<"post", U, P, B, BT, Q, H, string, RT>> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,max-len
        return this.request("POST", url, data, options) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    public request<
        Mthd extends string,
        U extends keyof RL[Uppercase<Mthd>] & string,
        P extends RL[Uppercase<Mthd>][U]["params"],
        B extends RL[Uppercase<Mthd>][U]["body"],
        BT extends RL[Uppercase<Mthd>][U]["bodyType"],
        Q extends RL[Uppercase<Mthd>][U]["query"],
        H extends RL[Uppercase<Mthd>][U]["headers"],
        D extends RequestData<P, B, BT, Q, H>,
        RB extends RL[Uppercase<Mthd>][U]["response"],
        RT extends ExpectedResponseBodyType = T,
    >(
        method: Mthd, url: U, data?: D, options?: RequestOptions<RT, H>,
    ): AbortablePromise<RT extends ExpectedResponseBodyType.json
            ? ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT>
            : ApiResponse<Mthd, U, P, B, BT, Q, H, string, RT>> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-explicit-any
        return this._prepareAndSendRequest(method, url, data, options) as any;
    }

    // eslint-disable-next-line max-lines-per-function
    private _prepareAndSendRequest<
        Mthd extends string,
        U extends keyof RL[Uppercase<Mthd>] & string,
        P extends RL[Uppercase<Mthd>][U]["params"],
        B extends RL[Uppercase<Mthd>][U]["body"],
        BT extends RL[Uppercase<Mthd>][U]["bodyType"],
        Q extends RL[Uppercase<Mthd>][U]["query"],
        H extends RL[Uppercase<Mthd>][U]["headers"],
        D extends RequestData<P, B, BT, Q, H>,
        RB extends RL[Uppercase<Mthd>][U]["response"],
        RT extends ExpectedResponseBodyType = T,
    >(
        method: Mthd, url: U, data?: D, options?: RequestOptions<RT, H>,
    ): AbortablePromise<RT extends ExpectedResponseBodyType.json
            ? ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT>
            : ApiResponse<Mthd, U, P, B, BT, Q, H, string, RT>> {
        // ------------

        type ApiReturnType = RT extends ExpectedResponseBodyType.json
            ? ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT>
            : ApiResponse<Mthd, U, P, B, BT, Q, H, string, RT>;

        const start = Date.now();
        const finalOptions = this._buildFetchOptions(options ?? {}, method.toUpperCase(), data?.body, data?.headers);
        const finalUrl = this._buildUrl(url, data?.params, data?.query, finalOptions);
        const request = new ApiRequest(method.toUpperCase(), { url: url, fullUrl: finalUrl }, data, finalOptions);

        let cacheKey: string | undefined = undefined,
            currentController: AbortController | undefined = undefined,
            globalTimeout: Timeout | undefined = undefined,
            aborted = false,
            timedoutGlobal = false;

        const globalBreak = () => {
            timedoutGlobal = true;
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            future.abort();
        };

        // @ts-expect-error Can we make it work without making abort optional and without ts-ignore?
        // eslint-disable-next-line max-lines-per-function
        const future: AbortablePromise<ApiReturnType> = new Promise<ApiReturnType>((resolve, reject) => {
            let tryNo = 0,
                lastError: Error | null = null;

            // eslint-disable-next-line max-statements
            (async () => {
                // @TODO skip cache stuff on retry
                if (finalOptions.cache?.key) {
                    cacheKey = typeof finalOptions.cache.key === "string"
                        ? finalOptions.cache.key
                        : finalOptions.cache.key({
                            ...pick(request, [
                                "method", "url", "fullUrl", "body", "headers", "params", "query", "bodyType",
                            ]),
                            options: pick(request.options, [
                                "responseType", "base", "fetchOptions",
                            ]),
                        });

                    if (cacheKey) {
                        const cachedData = await finalOptions.cache.storage.get(cacheKey);
                        if (cachedData) {
                            const d = JSON.parse(cachedData) as CachedData;

                            // eslint-disable-next-line @typescript-eslint/return-await
                            return await this._buildResponse(request, {
                                status: d.status,
                                statusText: d.statusText,
                                bodyText: d.body,
                                headers: d.headers,
                            }, true);
                        }
                    }
                }

                while (tryNo === 0 || finalOptions.retry.shouldRetry({ tryNo: tryNo + 1 })) {
                    tryNo++;
                    let timedoutLocal = false;
                    currentController = new AbortController();
                    // eslint-disable-next-line @typescript-eslint/no-loop-func
                    const singleTimeout = new Timeout(() => {
                        timedoutLocal = true;
                        currentController!.abort();
                    }, typeof finalOptions.timeout === "number" ? finalOptions.timeout : finalOptions.timeout.single);

                    try {
                        if (tryNo > 1) {
                            await wait(finalOptions.retry.interval({ tryNo }));
                        }
                        if (aborted) {
                            const errorDetails: AbortErrorDetails = {
                                while: "waiting",
                                tries: tryNo - 1,
                            };

                            const becauseOfTimeout = timedoutLocal || timedoutGlobal;

                            lastError = becauseOfTimeout
                                // @TODO messages
                                ? new TimeoutError("Connection timed TODO", errorDetails)
                                : new AbortError("Req abort", errorDetails);
                        }
                        singleTimeout.start();

                        return await this._sendRequest(request, currentController.signal);
                    }
                    catch (e: unknown) {
                        const normalized = UnknownError.normalize(e);
                        if (normalized.name === "AbortError") {
                            // @TODO duplicated section
                            const errorDetails: AbortErrorDetails = {
                                while: "connection",
                                tries: tryNo,
                            };

                            const becauseOfTimeout = timedoutLocal || timedoutGlobal;

                            lastError = becauseOfTimeout
                                // @TODO messages
                                ? new TimeoutError("Connection timed TODO", errorDetails)
                                : new AbortError("Req abort", errorDetails);

                            if (timedoutGlobal) {
                                // prevent more retries
                                break;
                            }
                            continue;
                        }
                        lastError = UnknownError.normalize(e);
                    }
                    finally {
                        singleTimeout.stop();
                    }
                }
                throw lastError ? lastError : new Error("No error??"); // @TODO what to do? is this possible?
            })().then(async (resp) => {
                // @TODO add option to wait for cache before resolving
                if (cacheKey) {
                    const shouldCache = finalOptions.cache?.shouldCacheResponse;
                    if (shouldCache) {
                        const sc = typeof shouldCache === "function" ? shouldCache(resp) : shouldCache;
                        if (sc) {
                            await finalOptions.cache!.storage.set(cacheKey, JSON.stringify({
                                ...pick(resp, ["status", "statusText", "headers"]),
                                body: typeof resp.body === "string" ? resp.body : JSON.stringify(resp.body),
                            })).catch(console.error); // @TODO
                        }
                    }
                }
                resolve(resp);
            }, async (e: unknown) => {
                if (cacheKey && e instanceof HttpError) {
                    const shouldCache = finalOptions.cache?.shouldCacheResponse;
                    const resp = e.details?.response;
                    if (shouldCache && resp) {
                        const sc = typeof shouldCache === "function" ? shouldCache(resp) : shouldCache;
                        if (sc) {
                            await finalOptions.cache!.storage.set(cacheKey, JSON.stringify({
                                ...pick(resp, ["status", "statusText", "headers"]),
                                body: typeof resp.body === "string" ? resp.body : JSON.stringify(resp.body),
                            })).catch(console.error); // @TODO
                        }
                    }
                }

                if (e instanceof HttpClientError
                    && e.details && !e.details.response.request.options.throw.onClientErrorResponses) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    resolve(e.details.response as any);
                    return;
                }
                if (e instanceof HttpServerError
                    && e.details && !e.details.response.request.options.throw.onServerErrorResponses) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    resolve(e.details.response as any);
                    return;
                }
                reject(UnknownError.normalize(e));
            });
        });

        future.finally(() => {
            globalTimeout?.stop();
        }).catch(noop);

        future.abort = () => {
            aborted = true;
            currentController?.abort();
        };

        if (
            typeof finalOptions.timeout !== "number"
            && finalOptions.timeout.total > 0
            && Number.isFinite(finalOptions.timeout.total)
            // TODO these checks could be avoided if we do runtime checks somewhere above
        ) {
            globalTimeout = new Timeout(globalBreak, finalOptions.timeout.total, true);
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return future as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    private async _sendRequest<
        Mthd extends string,
        U extends keyof RL[Uppercase<Mthd>] & string,
        P extends RL[Uppercase<Mthd>][U]["params"],
        B extends RL[Uppercase<Mthd>][U]["body"],
        BT extends RL[Uppercase<Mthd>][U]["bodyType"],
        Q extends RL[Uppercase<Mthd>][U]["query"],
        H extends RL[Uppercase<Mthd>][U]["headers"],
        RB extends RL[Uppercase<Mthd>][U]["response"],
        AReq extends ApiRequest<Mthd, U, P, B, BT, Q, H, RT>,
        RT extends ExpectedResponseBodyType = T,
    >(request: AReq, signal: AbortSignal): Promise<RT extends ExpectedResponseBodyType.json
        ? ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT>
        : ApiResponse<Mthd, U, P, B, BT, Q, H, string, RT>> {
        const h = request.options.fetchOptions.headers;

        const response = await this._dependencies.fetch(request.fullUrl, {
            ...omit(request.options.fetchOptions, ["headers"]),
            ...(h ? { headers: h } : {}),
            signal,
        });
        const bodyText = (await response.text());

        return this._buildResponse(request, {
            bodyText: bodyText,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
        });
    }

    private _buildResponse<
        Mthd extends string,
        U extends keyof RL[Uppercase<Mthd>] & string,
        P extends RL[Uppercase<Mthd>][U]["params"],
        B extends RL[Uppercase<Mthd>][U]["body"],
        BT extends RL[Uppercase<Mthd>][U]["bodyType"],
        Q extends RL[Uppercase<Mthd>][U]["query"],
        H extends RL[Uppercase<Mthd>][U]["headers"],
        RB extends RL[Uppercase<Mthd>][U]["response"],
        AReq extends ApiRequest<Mthd, U, P, B, BT, Q, H, RT>,
        RT extends ExpectedResponseBodyType = T,
    >(request: AReq, response: {
        bodyText: string;
        status: number;
        statusText: string;
        headers: H;
    }, cached = false): Promise<RT extends ExpectedResponseBodyType.json
            ? ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT>
            : ApiResponse<Mthd, U, P, B, BT, Q, H, string, RT>> {
        let jsonData: RB | undefined;

        const jsonWanted = request.options.responseType === ExpectedResponseBodyType.json;
        if (jsonWanted) {
            try {
                jsonData = JSON.parse(response.bodyText) as RB;
            }
            catch {}
        }

        const typeMismatch = jsonWanted && jsonData === undefined;

        const finalResult = createResponse({
            status: response.status,
            statusText: response.statusText,
            request: request,
            body: jsonData ?? response.bodyText,
            headers: response.headers,
        }, cached);

        if (typeMismatch) {
            throw new ResponseDataTypeMismatchError("Server returned data in unexpected format", {
                response: finalResult,
                expectedType: request.options.responseType,
            });
        }

        if (finalResult instanceof ClientErrorResponse) {
            throw new HttpClientError(response.statusText, { response: finalResult });
        }
        if (finalResult instanceof ServerErrorResponse) {
            throw new HttpServerError(response.statusText, { response: finalResult });
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return finalResult as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    }
}

const createApiClient = <
    RSP extends ApiEndpoints, T extends ExpectedResponseBodyType = ExpectedResponseBodyType.json,
>(options: Options<T, GenericHeaders>, dependencies?: ApiClientConfig) => {
    return new ApiClient<T, RSP>(options);
};

export {
    createApiClient,
    ResponseDataTypeMismatchError,
};

export {
    AbortedResponse,
    InformationalResponse,
    SuccessResponse,
    RedirectResponse,
    ClientErrorResponse,
    ServerErrorResponse,
} from "./response/response.js";
