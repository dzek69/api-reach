import type { RequestBodyType } from "../const";

type BasicJSONTypes = string | number | boolean | null;
type JSONFriendly = BasicJSONTypes | JSONFriendly[] | { [key: string]: JSONFriendly };

type AbortablePromise<T> = {
    abort: () => void;
} & Promise<T>;

type RecordLike<T> = {
    [key: string]: T;
};

type GenericJSONResponse = RecordLike<unknown>;
type GenericParams = RecordLike<BasicJSONTypes> | undefined;
type GenericBody = RecordLike<unknown> | string | undefined;
type GenericQuery = RecordLike<unknown> | undefined;
type GenericHeaders = RecordLike<string> | undefined;

/**
 * This type is a constraint for the ApiClient class, it represents a generic list of responses for methods and urls
 */
type ApiEndpoints = Record<string, Record<string, {
    /**
     * Expected response type (not validated, just assumed)
     */
    response: GenericJSONResponse;
    /**
     * Params list (to replace `:param` in url)
     */
    params?: GenericParams;
    /**
     * Request body data type
     */
    body?: GenericBody;
    bodyType?: RequestBodyType;
    /**
     * URL Query data type
     */
    query?: GenericQuery;
    /**
     * Headers data type
     */
    headers?: GenericHeaders;
}>>;

export type {
    BasicJSONTypes,
    JSONFriendly,
    ApiEndpoints,
    AbortablePromise,

    GenericJSONResponse,
    GenericParams,
    GenericBody,
    GenericQuery,
    GenericHeaders,
};
