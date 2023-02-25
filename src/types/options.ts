import type { RequestRedirect as NodeFetchRequestRedirect } from "node-fetch";
import type { ExpectedResponseBodyType, RequestBodyType } from "../const";
import type { GenericHeaders } from "./common";

/**
 * Base options, used then creating a new instance of `ApiClient`.
 */
interface Options<RT extends ExpectedResponseBodyType, H extends GenericHeaders> {
    base?: string;
    responseType?: RT;
    requestType?: RequestBodyType;
    // retry stuff
    // timeout
    // total
    // cache styff
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
> = Omit<Required<Options<T, H>>, "base"> & {
    base?: string;
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
