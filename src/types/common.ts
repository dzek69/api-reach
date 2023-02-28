import type { RequestBodyType } from "../const";

type BasicJSONTypes = string | number | boolean | null;
type JSONFriendly = BasicJSONTypes | JSONFriendly[] | { [key: string]: JSONFriendly };

type AbortablePromise<T> = {
    abort: () => void;
} & Promise<T>;

type GenericJSONResponse = Record<string, unknown>;
type GenericParams = Record<string, BasicJSONTypes> | undefined;
type GenericBody = Record<string, unknown> | string | undefined;
type GenericQuery = Record<string, unknown> | undefined;
type GenericHeaders = Record<string, string> | undefined;

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
     * Body data type
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
