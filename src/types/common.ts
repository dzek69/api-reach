import type { RequestBodyType } from "../const";

type BasicJSONTypes = string | number | boolean | null;
type JSONFriendly = BasicJSONTypes | JSONFriendly[] | { [key: string]: JSONFriendly };

type AbortablePromise<T> = {
    abort: () => void;
} & Promise<T>;

type RecordLike<T> = {
    [key: string]: T;
};

type GenericJSONResponse = RecordLike<unknown> | JSONFriendly[];
type GenericParams = RecordLike<BasicJSONTypes> | undefined;
type GenericBody = RecordLike<unknown> | string | undefined;
type GenericQuery = RecordLike<unknown> | undefined;
type GenericHeaders = RecordLike<string> | undefined;

type RemoveIndex<T> = {
    [ K in keyof T as
    string extends K
        ? never
        : number extends K
            ? never
            : symbol extends K
                ? never
                : K
    ]: T[K];
};

/**
 * This type is a constraint for the ApiClient class, it represents a generic list of responses for methods and urls
 */
type ApiEndpoints = RecordLike<RecordLike<{
    /**
     * Expected response type (not validated, just assumed)
     */
    response: RemoveIndex<GenericJSONResponse>;
    /**
     * Params list (to replace `:param` in url)
     */
    params?: RemoveIndex<GenericParams>;
    /**
     * Request body data type
     */
    body?: RemoveIndex<GenericBody>;
    bodyType?: RequestBodyType;
    /**
     * URL Query data type
     */
    query?: RemoveIndex<GenericQuery>;
    /**
     * Headers data type
     */
    headers?: RemoveIndex<GenericHeaders>;
}>>;

type ValidateApiEndpoints<T extends ApiEndpoints> = T;

export type {
    BasicJSONTypes,
    JSONFriendly,
    ApiEndpoints,
    ValidateApiEndpoints,
    AbortablePromise,

    GenericJSONResponse,
    GenericParams,
    GenericBody,
    GenericQuery,
    GenericHeaders,
};
