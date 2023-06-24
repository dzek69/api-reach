import type { ApiRequest } from "../request/request";
import type { ExpectedResponseBodyType, RequestBodyType } from "../const";
import type { GenericBody, GenericHeaders, GenericParams, GenericQuery, GenericJSONResponse } from "./common";
import type { ApiResponse } from "../response/response";

interface CacheInterface {
    get: (key: string) => Promise<string | undefined>;
    set: (key: string, value: string, ttl?: number) => Promise<boolean>;
    delete: (key: string) => Promise<boolean>;
    clear: () => Promise<void>;
}

type CacheGetKey = <
    Mthd extends string, U extends string,
    P extends GenericParams, B extends GenericBody,
    BT extends RequestBodyType | undefined, Q extends GenericQuery,
    H extends GenericHeaders, RT extends ExpectedResponseBodyType,
>(
    request: Pick<
    ApiRequest<Mthd, U, P, B, BT, Q, H, RT>,
    "method" | "url" | "fullUrl" | "body" | "headers" | "params" | "query" | "bodyType"
    > & {
        options: Pick<
        ApiRequest<Mthd, U, P, B, BT, Q, H, RT>["options"],
        "responseType" | "base" | "fetchOptions"
        >;
    }
) => string | undefined;

type CacheGetTTL = <
    Mthd extends string, U extends string,
    P extends GenericParams, B extends GenericBody,
    BT extends RequestBodyType | undefined, Q extends GenericQuery,
    H extends GenericHeaders, RT extends ExpectedResponseBodyType,
>(request: ApiRequest<Mthd, U, P, B, BT, Q, H, RT>) => number | undefined;

type CacheShouldCacheResponse = <
    Mthd extends string, U extends string,
    P extends GenericParams, B extends GenericBody,
    BT extends RequestBodyType | undefined, Q extends GenericQuery,
    H extends GenericHeaders,
    RB extends (GenericJSONResponse | string), RT extends ExpectedResponseBodyType,
>(response: ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT>) => boolean;

type CacheLoadStrategy = "prefer-cache" | "prefer-request" | "cache-only" | "request-only";
type CacheSaveStrategy = "save" | "no-save";

export type {
    CacheInterface,
    CacheGetKey,
    CacheGetTTL,
    CacheShouldCacheResponse,
    CacheLoadStrategy,
    CacheSaveStrategy,
};
