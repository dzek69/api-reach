import type { FetchOptions } from "../types";

interface ApiRequestData {
    url: string;
    options: FetchOptions;
}

class ApiRequest implements ApiRequestData {
    /**
     * Full stringified URL that was accessed (before redirects)
     */
    public readonly url: string;

    /**
     * Merged options (for `fetch` method) that was given for the request
     */
    public readonly options: FetchOptions;

    // @TODO original URL
    // @TODO original params
    // @TODO original body
    // @TODO original query
    // @TODO original headers
    // @TODO original method

    public constructor({ url, options }: ApiRequestData) {
        this.url = url;
        this.options = options;
    }
}

export {
    ApiRequest,
};
