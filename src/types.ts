import type { RequestType } from "./const";
import type { Response as NodeFetchResponse } from "node-fetch";
import type { ClientHttpError, ResponseDataTypeMismatchError, ServerHttpError } from "./errors";
import type { PossibleNonErrorResponses } from "./response/response";

type Data = object;

interface RetryInfo {
    count: number;
}

interface CacheInterface {
    get: (key: string) => Promise<string | undefined>;
    set: (key: string, value: string) => Promise<boolean>;
    delete: (key: string) => Promise<boolean>;
    clear: () => Promise<void>;
}

interface RequestInformation {
    method: string;
    url: string;
    body?: string;
    headers: object;
}

type CacheGetKey = (reqInfo: RequestInformation) => string | undefined;

type CacheShouldCache = (response: PossibleNonErrorResponses | PossibleCustomErrorsThrown) => boolean;

/**
 * @typedef {Object} Options
 * @property {string} type - expected data type
 * @property {Object} headers - headers to be send with each request
 * @property {number} retry - how many times should request try to get a successful response. Can be overridden with
 * retryPolicy. 1 = no retry, 2 = one retry, etc.
 * @property {number} retryInterval - time between retries. Can be overriden with retryWaitPolicy
 * @property {function} retryPolicy - function that decides if request should be retried
 * @property {function} retryWaitPolicy - function that decides how much time to wait before next retry
 * @property {number} timeout - timeout for each request
 * @property {number} totalTimeout - total timeout in which all, including retried requests should be fulfilled
 * (this includes wait time between, so timeout=100, wait=200, totalTimeout=350 means that retry will have only 50ms)
 */
interface Options {
    base?: string;
    type?: RequestType;
    headers?: Data;
    retry?: number;
    retryInterval?: number;
    retryPolicy?: (retryInfo: RetryInfo) => boolean;
    retryWaitPolicy?: (retryInfo: RetryInfo) => number;
    timeout?: number;
    totalTimeout?: number;
    cache?: CacheInterface | null;
    cacheKey?: CacheGetKey;
    shouldCacheResponse?: CacheShouldCache;
}

type FetchOptions = Omit<Required<Options>, "base"> & {
    method: string;
    body?: string;
    base?: string;
    headers: Data;
};

type URLArgument = string | string[];
type BodyArgument = string | Data | Data[] | null;

interface AbortErrorDetails {
    tries: number;
    while: "waiting" | "connection";
    timeout: boolean;
    globalTimeout: boolean;
}

interface AbortErrorObject {
    isTimeouted: boolean;
    isGlobalTimeouted: boolean;
    lastError: Error | null;
    errorDetails: AbortErrorDetails | null;
}

type AbortablePromise<T> = {
    abort?: () => void;
} & Promise<T>;

interface ResponseDataJSON<T> {
    type: RequestType.json;
    body: T;
}

interface ResponseDataText {
    type: RequestType.text;
    body: string;
    rawBody?: string;
}

interface ResponseDataBinary {
    type: RequestType.binary;
    body: Buffer;
}

interface ResponseDataStream {
    type: RequestType.stream;
    body: NodeFetchResponse["body"];
}

type ResponseData<TJ> = ResponseDataJSON<TJ> | ResponseDataText | ResponseDataBinary | ResponseDataStream;

interface ConfigureOptions {
    URL: typeof URL;
}

type FetchLikeData = Pick<NodeFetchResponse, "status" | "statusText" | "headers">;

interface ParsedResponse {
    status: NodeFetchResponse["status"];
    statusText: NodeFetchResponse["statusText"];
    headers: { [key: string]: string };
    request: {
        url: string;
        originalUrl: string;
        queryParams: { [key: string]: string };
        options: FetchOptions & {
            retryPolicy: string;
            retryWaitPolicy: string;
        };
    };
    type: RequestType.text;
    body: string;
    rawBody?: string;
}

interface ParsedError {
    error: string;
    message: string;
    details: {
        response: ParsedResponse;
        [s: string]: unknown;
    };
}

type PossibleCustomErrorsThrown = ReturnType<typeof ResponseDataTypeMismatchError>
| ReturnType<typeof ClientHttpError>
| ReturnType<typeof ServerHttpError>;

export type {
    Data,
    Options,
    FetchOptions,
    URLArgument,
    BodyArgument,
    AbortErrorDetails,
    AbortErrorObject,
    AbortablePromise,
    ResponseData,
    ResponseDataJSON,
    ResponseDataText,
    ResponseDataBinary,
    ResponseDataStream,
    ConfigureOptions,
    FetchLikeData,
    ParsedResponse,
    ParsedError,
    PossibleCustomErrorsThrown,
};
