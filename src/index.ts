/* eslint-disable max-lines */
import urlJoin from "url-join";
import qs from "qs";
import { Timeout } from "oop-timers";
import { noop, omit, pick, replace, wait } from "@ezez/utils";

import type { AbortErrorDetails } from "./errors";
import type { ApiResponse } from "./response/response.js";
import type {
    AbortablePromise,
    ApiEndpoints,
    CachedData,
    CacheOptions,
    Dependencies,
    FinalOptions,
    GenericBody,
    GenericHeaders,
    GenericParams,
    GenericQuery,
    Options,
    RequestData,
    RequestOptions,
    BodyType,
    BodyTypeType,
    HeadersType,
    ParamsType,
    QueryType,
    ValidateApiEndpoints,
} from "./types";

import { ClientErrorResponse, createResponse, ServerErrorResponse } from "./response/response.js";
import { contentTypeMap, ExpectedResponseBodyType, RequestBodyType } from "./const.js";
import {
    AbortError,
    HttpClientError,
    HttpError,
    HttpServerError,
    ResponseDataTypeMismatchError,
    TimeoutError,
    UnknownError,
    CacheMissError,
    ApiReachError,
} from "./errors.js";
import { ApiRequest } from "./request/request.js";

const defaultOptions: Pick<
Required<Options<ExpectedResponseBodyType, any>>, // eslint-disable-line @typescript-eslint/no-explicit-any
"requestType" | "responseType" | "timeout" | "retry" | "throw"
> & { cache: Partial<Options<ExpectedResponseBodyType, any>["cache"]> } = { // eslint-disable-line @typescript-eslint/no-explicit-any,max-len
    responseType: ExpectedResponseBodyType.json,
    requestType: RequestBodyType.json,
    timeout: 30000,
    retry: 0,
    throw: {
        onServerErrorResponses: true,
        onClientErrorResponses: true,
    },
    cache: {
        loadStrategy: "prefer-cache",
        saveStrategy: "save",
    },
};

class ApiClient<T extends ExpectedResponseBodyType, RL extends ApiEndpoints> {
    private readonly _options: Options<T, GenericHeaders>;

    private readonly _dependencies: Dependencies;

    public constructor(options?: Options<T, GenericHeaders>, dependencies?: Partial<Dependencies>) {
        this._options = options ?? {};
        this._dependencies = {
            // TODO this will crash on envs without these, fix by creating a function that "fills missing"
            fetch: fetch,
            URL: URL,
            qsStringify: qs.stringify,
            AbortController: AbortController,
            ...dependencies,
        };
    }

    /**
     * Returns final expected response data type
     */
    private _getResponseType<
        RT extends ExpectedResponseBodyType,
        Op extends Options<RT, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
    >(options: Pick<Op, "responseType">): ExpectedResponseBodyType {
        return options.responseType ?? this._options.responseType ?? ExpectedResponseBodyType.json;
    }

    /**
     * Returns final request data type
     */
    private _getRequestType(options: Pick<Options<any, any>, "requestType">): RequestBodyType { // eslint-disable-line @typescript-eslint/no-explicit-any,max-len
        return options.requestType ?? this._options.requestType ?? RequestBodyType.json;
    }

    /**
     * Get request content type
     * @param options
     * @private
     */
    private _getContentType(options: Pick<Options<any, any>, "responseType">) { // eslint-disable-line @typescript-eslint/no-explicit-any,max-len
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
    >(options: Pick<Options<any, any>, "requestType">, body?: B) { // eslint-disable-line @typescript-eslint/no-explicit-any,max-len
        const requestType = this._getRequestType(options);

        if (requestType === RequestBodyType.plain && typeof body !== "string") {
            throw new Error("Body must be a string when request type is set to plain text");
        }

        if (typeof body === "string") {
            return body;
        }

        if (requestType === RequestBodyType.json) {
            return JSON.stringify(body);
        }
        if (requestType === RequestBodyType.urlencoded) {
            return this._dependencies.qsStringify(body);
        }

        return null;
    }

    // eslint-disable-next-line max-lines-per-function
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

        const cache = this._buildCacheOptions(options);

        const opts: FinalOptions<ExpectedResponseBodyType, NonNullable<GenericHeaders>> = {
            // @TODO filter only known options?
            ...omit(defaultOptions, ["cache"]),
            ...omit(this._options, ["cache"]),
            ...omit(options, ["cache"]),
            retry: {
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
            ...(cache ? { cache } : undefined),
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

    private readonly _buildCacheOptions = <
        RT extends ExpectedResponseBodyType,
        H extends GenericHeaders,
    >(options: RequestOptions<RT, H>): CacheOptions | null => {
        const storage = this._options.cache?.storage ?? options.cache?.storage;
        if (!storage) {
            return null;
        }
        const cache: Partial<CacheOptions> = {
            ...defaultOptions.cache,
            ...this._options.cache,
            ...options.cache,
        };

        if (
            !cache.storage || !cache.loadStrategy || !cache.saveStrategy
            || !cache.key || !("ttl" in cache) || !cache.shouldCacheResponse
        ) {
            return null;
        }

        return cache as CacheOptions;
    };

    /**
     * Either correctly parses url or returns null, no throwing
     */
    private _safeUrlParse(url?: string) {
        if (!url) {
            return null;
        }

        try {
            return new this._dependencies.URL(url);
        }
        catch {}

        return null;
    }

    /**
     * Builds url with base
     */
    private _buildUrlBase(url: string, base?: string) {
        const parsedBase = this._safeUrlParse(base);
        const parsedUrl = this._safeUrlParse(url);

        if (!parsedBase?.host) {
            if (typeof window === "object") {
                // No base url in browser - just use the url, either relative or absolute
                return url;
            }

            if (!parsedUrl?.host) {
                // No full URL can be constructed on server side
                throw new ApiReachError(
                    `No base url given and url ${url} is not absolute. This is valid in browsers but `
                    + `invalid on server.`,
                );
            }

            // url is absolute
            return url;
        }

        if (parsedUrl) { // base is valid full url and given url is also full url
            throw new ApiReachError(
                `Cannot use absolute url ${url} with base url ${base!}. `,
            );
        }

        return urlJoin(base!, url);
    }

    /**
     * Builds final URL to send request to
     */
    private _buildUrl(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        givenUrl: string, params: GenericParams, query: GenericQuery, fetchOptions: FinalOptions<any, any>,
    ) {
        const localUrl = replace(givenUrl, params as (Record<string, string> | undefined) ?? {});
        const fullUrl = this._buildUrlBase(localUrl, fetchOptions.base);
        if (!query || !Object.keys(query).length) {
            return fullUrl;
        }
        const hasQuery = fullUrl.includes("?");
        const appendChar = hasQuery ? "&" : "?";

        if (hasQuery) {
            console.warn(
                "api-reach: query params object was given with url that already has query params. "
                + "This behavior is unsupported and may lead to unexpected results.",
            );
        }

        return fullUrl + appendChar + this._dependencies.qsStringify(query);
    }

    public get<
        U extends keyof RL["get"] & string,
        P extends ParamsType<RL["get"][U]>,
        B extends BodyType<RL["get"][U]>,
        BT extends BodyTypeType<RL["get"][U]>,
        Q extends QueryType<RL["get"][U]>,
        H extends HeadersType<RL["get"][U]>,
        D extends RequestData<P, B, BT, Q, H>,
        RB extends RL["get"][U]["response"],
        RT extends ExpectedResponseBodyType = T,
    >(
        url: U, data: D, options?: RequestOptions<RT, H>,
    ): AbortablePromise<
        RT extends ExpectedResponseBodyType.json
            ? ApiResponse<"get", U, P, B, BT, Q, H, RB, RT> :
            RT extends ExpectedResponseBodyType.stream ?
                ApiResponse<"get", U, P, B, BT, Q, H, ReadableStream, RT>
                : ApiResponse<"get", U, P, B, BT, Q, H, string, RT>
        > {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return this.request("GET", url, data, options) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    public post<
        U extends keyof RL["post"] & string,
        P extends ParamsType<RL["post"][U]>,
        B extends BodyType<RL["post"][U]>,
        BT extends BodyTypeType<RL["post"][U]>,
        Q extends QueryType<RL["post"][U]>,
        H extends HeadersType<RL["post"][U]>,
        D extends RequestData<P, B, BT, Q, H>,
        RB extends RL["post"][U]["response"],
        RT extends ExpectedResponseBodyType = T,
    >(
        url: U, data: D, options?: RequestOptions<RT, H>,
    ): AbortablePromise<RT extends ExpectedResponseBodyType.json
            ? ApiResponse<"post", U, P, B, BT, Q, H, RB, RT> :
            RT extends ExpectedResponseBodyType.stream ?
                ApiResponse<"post", U, P, B, BT, Q, H, ReadableStream, RT>
                : ApiResponse<"post", U, P, B, BT, Q, H, string, RT>> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,max-len
        return this.request("POST", url, data, options) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    public request<
        Mthd extends string,
        U extends keyof RL[Lowercase<Mthd>] & string,
        P extends ParamsType<RL[Lowercase<Mthd>][U]>,
        B extends BodyType<RL[Lowercase<Mthd>][U]>,
        BT extends BodyTypeType<RL[Lowercase<Mthd>][U]>,
        Q extends QueryType<RL[Lowercase<Mthd>][U]>,
        H extends HeadersType<RL[Lowercase<Mthd>][U]>,
        D extends RequestData<P, B, BT, Q, H>,
        RB extends RL[Lowercase<Mthd>][U]["response"],
        RT extends ExpectedResponseBodyType = T,
    >(
        method: Mthd, url: U, data: D, options?: RequestOptions<RT, H>,
    ): AbortablePromise<RT extends ExpectedResponseBodyType.json
            ? ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT> :
            RT extends ExpectedResponseBodyType.stream ?
                ApiResponse<Mthd, U, P, B, BT, Q, H, ReadableStream, RT>
                : ApiResponse<Mthd, U, P, B, BT, Q, H, string, RT>> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-explicit-any
        return this._prepareAndSendRequest(method, url, data, options) as any;
    }

    // eslint-disable-next-line max-lines-per-function
    private _prepareAndSendRequest<
        Mthd extends string,
        U extends keyof RL[Lowercase<Mthd>] & string,
        P extends ParamsType<RL[Lowercase<Mthd>][U]>,
        B extends BodyType<RL[Lowercase<Mthd>][U]>,
        BT extends BodyTypeType<RL[Lowercase<Mthd>][U]>,
        Q extends QueryType<RL[Lowercase<Mthd>][U]>,
        H extends HeadersType<RL[Lowercase<Mthd>][U]>,
        D extends RequestData<P, B, BT, Q, H>,
        RB extends RL[Lowercase<Mthd>][U]["response"],
        RT extends ExpectedResponseBodyType = T,
    >(
        method: Mthd, url: U, data: D, options?: RequestOptions<RT, H>,
    ): AbortablePromise<RT extends ExpectedResponseBodyType.json
            ? ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT>
            : ApiResponse<Mthd, U, P, B, BT, Q, H, string, RT>> {
        // ------------

        type ApiReturnType = RT extends ExpectedResponseBodyType.json
            ? ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT>
            : ApiResponse<Mthd, U, P, B, BT, Q, H, string, RT>;

        const _data: D | undefined = data as D | undefined;

        const finalOptions = this._buildFetchOptions(options ?? {}, method.toUpperCase(), _data?.body, _data?.headers);
        const finalUrl = this._buildUrl(url, _data?.params, _data?.query, finalOptions);
        const request = new ApiRequest(method.toUpperCase(), { url: url, fullUrl: finalUrl }, _data, finalOptions);

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
                if (tryNo === 0 && finalOptions.cache?.key) {
                    // Calculate cache key to use when needed
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
                }

                const readFromCache = async () => {
                    if (cacheKey) {
                        const cachedData = await finalOptions.cache!.storage.get(cacheKey);
                        if (cachedData) {
                            const d = JSON.parse(cachedData) as CachedData;

                            // Note: There was `await` here previously
                            // @ts-expect-error Can't solve this TS issue
                            return this._buildResponse(request, {
                                status: d.status,
                                statusText: d.statusText,
                                bodyData: d.body,
                                headers: d.headers,
                            }, true);
                        }
                    }
                    return null;
                };

                const loadStrat = finalOptions.cache?.loadStrategy;
                if (loadStrat === "prefer-cache" || loadStrat === "cache-only") {
                    const cachedResponse = await readFromCache();
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    if (loadStrat === "cache-only") {
                        throw new CacheMissError("No cached data");
                    }
                }

                while (tryNo === 0 || finalOptions.retry.shouldRetry({ tryNo: tryNo + 1 })) {
                    tryNo++;
                    let timedoutLocal = false;
                    currentController = new this._dependencies.AbortController();
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
                                request: request,
                            };

                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                            const becauseOfTimeout = timedoutLocal || timedoutGlobal;

                            lastError = becauseOfTimeout
                                // @TODO messages
                                ? new TimeoutError(`Request to ${request.fullUrl} timed out`, errorDetails)
                                : new AbortError(`Request to ${request.fullUrl} aborted`, errorDetails);
                        }
                        singleTimeout.start();

                        // @ts-expect-error The same issue with request type I assume. TS gives broken message
                        return await this._sendRequest(request, currentController.signal);
                    }
                    catch (e: unknown) {
                        const normalized = UnknownError.normalize(e);
                        if (normalized.name === "AbortError") {
                            // @TODO duplicated section
                            const errorDetails: AbortErrorDetails = {
                                while: "connection",
                                tries: tryNo,
                                request: request,
                            };

                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                            const becauseOfTimeout = timedoutLocal || timedoutGlobal;

                            lastError = becauseOfTimeout
                                ? new TimeoutError(`Request to ${request.fullUrl} timed out`, errorDetails)
                                : new AbortError(`Request to ${request.fullUrl} aborted`, errorDetails);

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

                if (finalOptions.cache?.loadStrategy === "prefer-request") {
                    const cachedResponse = await readFromCache();
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                }

                throw lastError ?? new UnknownError(
                    "Internal api-reach error, this should never happen, please report it",
                );
            })().then(async (resp) => {
                if (cacheKey && !resp.cached && !(resp.body instanceof ReadableStream)) {
                    const cacheOpt = finalOptions.cache!;
                    const shouldCache = cacheOpt.shouldCacheResponse;
                    if (cacheOpt.saveStrategy === "save" && shouldCache) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-explicit-any
                        const ttl = typeof cacheOpt.ttl === "function" ? cacheOpt.ttl(resp as any) : cacheOpt.ttl;
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-explicit-any
                        const sc = typeof shouldCache === "function" ? shouldCache(resp as any) : shouldCache;
                        if (sc) {
                            await cacheOpt.storage.set(cacheKey, JSON.stringify({
                                ...pick(resp, ["status", "statusText", "headers"]),
                                body: typeof resp.body === "string" ? resp.body : JSON.stringify(resp.body),
                            }), ttl).catch(console.error); // @TODO
                        }
                    }
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-explicit-any
                resolve(resp as any);
            }, async (e: unknown) => {
                if (cacheKey && e instanceof HttpError) {
                    const cacheOpt = finalOptions.cache!;
                    const shouldCache = cacheOpt.shouldCacheResponse;
                    const resp = e.details?.response;
                    if (
                        cacheOpt.saveStrategy === "save" && shouldCache
                        && resp && !(resp.body instanceof ReadableStream)
                    ) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-explicit-any
                        const sc = typeof shouldCache === "function" ? shouldCache(resp as any) : shouldCache;
                        if (sc) {
                            await cacheOpt.storage.set(cacheKey, JSON.stringify({
                                ...pick(resp, ["status", "statusText", "headers"]),
                                body: typeof resp.body === "string" ? resp.body : JSON.stringify(resp.body),
                            })).catch(console.error); // @TODO
                        }
                    }
                }

                if (e instanceof HttpClientError
                    && e.details && !e.details.response.request.options.throw.onClientErrorResponses) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-explicit-any
                    resolve(e.details.response as any);
                    return;
                }
                if (e instanceof HttpServerError
                    && e.details && !e.details.response.request.options.throw.onServerErrorResponses) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
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

        const streamWanted = request.options.responseType === ExpectedResponseBodyType.stream;
        const bodyData = streamWanted ? (response.body ?? undefined) : (await response.text());

        return this._buildResponse(request, {
            bodyData: bodyData,
            status: response.status,
            statusText: response.statusText,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-explicit-any
            headers: Object.fromEntries((response.headers as Headers & { entries: () => any }).entries()),
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
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        AReq extends ApiRequest<Mthd, U, P, B, BT, Q, H, RT>,
        RT extends ExpectedResponseBodyType = T,
    >(request: AReq, response: {
        bodyData: string | ReadableStream<Uint8Array> | undefined;
        status: number;
        statusText: string;
        headers: GenericHeaders;
    }, cached = false): Promise<RT extends ExpectedResponseBodyType.json
            ? ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT>
            : ApiResponse<Mthd, U, P, B, BT, Q, H, string, RT>> {
        let jsonData: RB | undefined;

        const jsonWanted = request.options.responseType === ExpectedResponseBodyType.json;
        if (jsonWanted) {
            try {
                jsonData = JSON.parse(response.bodyData as string) as RB;
            }
            catch {}
        }

        const typeMismatch = jsonWanted && jsonData === undefined;

        const finalResult = createResponse({
            status: response.status,
            statusText: response.statusText,
            request: request,
            body: jsonData ?? response.bodyData,
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
>(options: Options<T, GenericHeaders>, dependencies?: Dependencies) => {
    return new ApiClient<T, RSP>(options, dependencies);
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

export type {
    ApiClient,
    ExpectedResponseBodyType,
    ApiEndpoints,
    ValidateApiEndpoints,
};
