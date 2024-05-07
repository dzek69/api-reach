import type { FinalOptions, GenericBody, GenericHeaders, GenericParams, GenericQuery, RequestData } from "../types";
import type { RequestBodyType, ExpectedResponseBodyType } from "../const";

class ApiRequest<
    Mthd extends string, U extends string,
    P extends GenericParams, B extends GenericBody,
    BT extends RequestBodyType | undefined, Q extends GenericQuery,
    H extends GenericHeaders, RT extends ExpectedResponseBodyType,
> {
    /**
     * Method used for the request
     */
    public readonly method: Mthd;

    /**
     * URL given (without base)
     */
    public readonly url: U;

    /**
     * Full URL that was accessed, including:
     * - base URL
     * - stringified query params
     * - stringified URL params (like `:id`)
     *
     * It's a URL before redirects
     */
    public readonly fullUrl: string;

    /**
     * Params given for the request (to resolve `:id` like parts of the URL)
     */
    public readonly params: P | undefined;

    /**
     * Body that was given for the request
     */
    public readonly body: B | undefined;

    /**
     * Body type that was given for the request
     */
    public readonly bodyType: BT | undefined;

    /**
     * Query params that were given for the request
     */
    public readonly query: Q | undefined;

    /**
     * Headers that were given for the request
     */
    public readonly headers: H | undefined;

    /**
     * Merged options (for `fetch` method) that were used for the request
     */
    public readonly options: FinalOptions<RT, GenericHeaders>;

    // @TODO body after stringifying?

    // @TODO body type is stored on the request directly
    // but it's in the options as well
    // what about response type?
    // it can be useful to get it outside too (for cache key functions for example)
    public constructor(
        method: Mthd, { url, fullUrl }: { url: U; fullUrl: string },
        data: RequestData<P, B, BT, Q, H> | undefined,
        options: FinalOptions<RT, GenericHeaders>,
    ) {
        this.method = method;
        this.url = url;
        this.fullUrl = fullUrl;
        // @TODO can we safely ignore it?
        // @ts-expect-error some random error
        this.params = data?.params;
        // @ts-expect-error some random error
        this.body = data?.body;
        // @ts-expect-error some random error
        this.bodyType = data?.bodyType;
        // @ts-expect-error some random error
        this.query = data?.query;
        // @ts-expect-error some random error
        this.headers = data?.headers;
        this.options = options;
    }
}

export {
    ApiRequest,
};
