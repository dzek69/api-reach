import type { RequestRedirect as NodeFetchRequestRedirect } from "node-fetch";
import type { ExpectedResponseBodyType, RequestBodyType } from "../const";
import type { GenericHeaders } from "./common";
import type { CacheGetKey, CacheInterface, CacheShouldCacheResponse } from "./cache";

interface RetryInfo {
    tryNo: number;
}

interface BasicRetry {
    count: number;
    interval: number;
}

interface AdvancedRetry {
    shouldRetry: (retryInfo: RetryInfo) => boolean;
    interval: (retryInfo: RetryInfo) => number;
}

type RetryOptions = number | BasicRetry | AdvancedRetry;

interface TimeoutOptions {
    single: number;
    total: number;
}

interface CacheOptions {
    storage: CacheInterface;
    strategy: "load-only" | "save-only" | "load-and-save" | "no-cache"; // @TODO | "revalidate"
    // todo this is wrong idea about how caches should work
    /**
     * A function that gets request data (method, url, query params etc.) and returns a key for the cache.
     * If key is given and exists the value will be read from the cache and returned.
     * If it returns `undefined`, the request will not be loaded from cache nor stored in the cache.
     */
    key: CacheGetKey;
    shouldCacheResponse: CacheShouldCacheResponse;
}

/**
 * Base options, used then creating a new instance of `ApiClient`.
 */
interface Options<RT extends ExpectedResponseBodyType, H extends GenericHeaders> {
    base?: string;
    responseType?: RT;
    requestType?: RequestBodyType;
    retry?: RetryOptions;
    timeout?: number | TimeoutOptions;
    cache?: CacheOptions;
    throw?: {
        onClientErrorResponses?: boolean;
        onServerErrorResponses?: boolean;
    };
    fetchOptions?: {
        headers?: H;
        redirect?: NodeFetchRequestRedirect;
    };
}

/**
 * Options, but for given request. It skips fetch options headers, because they are passed with the `data` argument.
 */
type RequestOptions<RT extends ExpectedResponseBodyType, H extends GenericHeaders> = Options<RT, H> & {
    fetchOptions?: Options<RT, H>["fetchOptions"] & {
        headers?: never;
    };
};

/**
 * Options that are build from defaults, instance options and request data & options and finally used to make a request.
 */
type FinalOptions<
    T extends ExpectedResponseBodyType, H extends GenericHeaders,
> = Omit<Required<Options<T, H>>, "base" | "cache" | "retry"> & {
    base?: string;
    cache?: Options<T, H>["cache"];
    retry: AdvancedRetry;
    fetchOptions?: {
        method: string;
        body?: string;
        headers: H;
        redirect?: NodeFetchRequestRedirect;
    };
};

interface ApiClientConfig {
    fetch: typeof fetch;
    URL: typeof URL;
    AbortController: typeof AbortController;
}

export type {
    Options,
    RequestOptions,
    FinalOptions,
    ApiClientConfig,
};
