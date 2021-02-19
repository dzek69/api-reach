import type { Data, FetchOptions, URLArgument } from "../types.js";

/**
 * @class ApiRequest
 * @property {string} url - parsed URL
 * @property {Object} options - merged options (for `fetch`) that was given for the request
 * @property {string} originalUrl - original URL as was given
 * @property {Object} queryParams - given query params
 */
class ApiRequest {
    public readonly url: string;

    public readonly options: FetchOptions;

    public readonly originalUrl: URLArgument;

    public readonly queryParams: Data;

    public constructor(url: string, options: FetchOptions, originalUrl: URLArgument, queryParams: Data) {
        this.url = url;
        this.options = options;
        this.originalUrl = originalUrl;
        this.queryParams = queryParams;
    }
}

export { ApiRequest };
