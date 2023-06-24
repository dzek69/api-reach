import type { RequestRedirect as NodeFetchRequestRedirect } from "node-fetch";
import type { ExpectedResponseBodyType, RequestBodyType } from "../const";
import type { GenericHeaders } from "./common";
import type {
    CacheGetKey, CacheGetTTL, CacheInterface, CacheShouldCacheResponse, CacheSaveStrategy, CacheLoadStrategy,
} from "./cache";

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
    loadStrategy: CacheLoadStrategy;
    saveStrategy: CacheSaveStrategy;
    /**
     * A function that accepts request data (method, url, query params etc.) and returns a key for the cache.
     * If a key is returned it might be used for reading from and saving to the cache (depending on the strategy).
     * If it returns `undefined`, the request will not be loaded from cache nor stored in the cache.
     */
    key: CacheGetKey | string;
    /**
     * A function that accepts request data (method, url, query params etc.) and returns a TTL for the cache.
     */
    ttl: CacheGetTTL | number | undefined;
    /**
     * A function that accepts response object (which includes request & response data) and returns a boolean indicating
     * whether this response should be cached (if the strategy allows it).
     */
    shouldCacheResponse: CacheShouldCacheResponse | boolean;
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
    cache?: CacheOptions | undefined;
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
type RequestOptions<RT extends ExpectedResponseBodyType, H extends GenericHeaders> = Omit<Options<RT, H>, "cache"> & {
    fetchOptions?: Options<RT, H>["fetchOptions"] & {
        headers?: never;
    };
    cache?: Partial<Options<RT, H>["cache"]>;
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
    CacheOptions,
    RequestOptions,
    FinalOptions,
    ApiClientConfig,
};
