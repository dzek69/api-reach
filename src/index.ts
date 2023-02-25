/* eslint-disable max-lines */
import urlJoin from "url-join";
import qs from "qs";

import type {
    ApiClientConfig,
    ApiEndpoints,
    FinalOptions,
    GenericBody,
    GenericHeaders, GenericParams, GenericQuery,
    Options,
    RequestData, RequestOptions,
} from "./types";

import { contentTypeMap, ExpectedResponseBodyType, RequestBodyType } from "./const.js";
import { ApiResponse } from "./response/response.js";

const defaultOptions: Pick<Required<Options<ExpectedResponseBodyType, any>>, "requestType" | "responseType"> = {
    responseType: ExpectedResponseBodyType.json,
    requestType: RequestBodyType.json,
};

class ApiClient<T extends ExpectedResponseBodyType, RL extends ApiEndpoints> {
    private readonly _options: Options<T, GenericHeaders>;

    public constructor(options?: Options<T, GenericHeaders>) {
        this._options = options ?? {};
    }

    /**
     * Returns final expected response data type
     */
    private _getResponseType<
        RT extends ExpectedResponseBodyType,
        Op extends Options<RT, any>,
    >(options: Op): ExpectedResponseBodyType {
        return options.responseType ?? this._options.responseType ?? ExpectedResponseBodyType.json;
    }

    /**
     * Returns final request data type
     */
    private _getRequestType(options: Options<any, any>): RequestBodyType {
        return options.requestType ?? this._options.requestType ?? RequestBodyType.json;
    }

    /**
     * Get request content type
     * @param options
     * @private
     */
    private _getContentType(options: Options<any, any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
        const type = this._getResponseType(options);
        return contentTypeMap[type];
    }

    /**
     * Prepares request body to send
     * @param options
     * @param body
     * @private
     */
    private _buildRequestBody<
        B extends GenericBody,
    >(options: Options<any, any>, body?: B) {
        const requestType = this._getRequestType(options);

        if (requestType === "plain" && typeof body !== "string") {
            throw new Error("Body must be a string when request type is set to plain text");
        }

        if (typeof body === "string") {
            // @TODO maybe crash if manually stringified? we have no control over the actual format anymore
            return body;
        }

        if (requestType === RequestBodyType.json) {
            return JSON.stringify(body); // @TODO plugin for custom serialization?
        }
        if (requestType === RequestBodyType.urlencoded) {
            return qs.stringify(body);
        }

        return null;
    }

    private _buildFetchOptions<
        RT extends ExpectedResponseBodyType,
        H extends GenericHeaders,
        M extends string,
        B extends GenericBody,
    >(options: RequestOptions<RT, H>, method: M, body?: B, headers?: H) {
        const instanceHeaders = this._options.fetchOptions?.headers ?? {};
        const requestHeaders = headers ?? {};

        const contentType: { "Content-Type"?: string } = {};
        const bodyOptions: { body?: string } = {};
        if (body != null) {
            const ct = this._getContentType(options);
            if (ct != null) {
                contentType["Content-Type"] = ct;
            }
            const bd = this._buildRequestBody(options, body);
            if (bd != null) {
                bodyOptions.body = bd;
            }
        }

        const opts: FinalOptions<ExpectedResponseBodyType, NonNullable<GenericHeaders>> = {
            // @TODO filter only known options?
            ...defaultOptions,
            ...this._options,
            ...options,
            fetchOptions: {
                ...this._options.fetchOptions,
                ...options.fetchOptions,
                ...bodyOptions,
                method: method,
                headers: { // @TODO handle same header with different case
                    ...instanceHeaders, // TODO handle multiple headers with same name
                    ...requestHeaders,
                    ...contentType,
                },
            },
        };

        // Object.defineProperty(opts, "toJSON", {
        //     value: () => ({ type: opts.type }),
        // });

        return opts;
    }

    /**
     * Either correctly parses url or returns null, no throwing
     */
    private _safeUrlParse(url?: string) {
        if (!url) {
            return null;
        }

        try {
            // @TODO replace URL with deps
            return new URL(url);
        }
        catch {}

        return null;
    }

    /**
     * Builds url with base
     */
    private _buildUrlBase(url: string, base?: string) {
        const parsedBase = this._safeUrlParse(base);
        if (!parsedBase?.host) {
            // if no base is given - just use the url
            // @TODO check for full url here? throw custom, meaningful error
            // local urls crashes on node
            // but it works in browsers
            return url;
        }

        // base is defined at this point
        const parsedUrl = this._safeUrlParse(url);
        if (parsedUrl) { // base is valid full url and given url is also full url
            throw new Error("Cannot use absolute url with base url."); // @todo throw custom type?
        }

        return urlJoin(base!, url);
    }

    /**
     * Builds final URL to send request to
     */
    private _buildUrl(
        givenUrl: string, params: GenericParams, query: GenericQuery, fetchOptions: FinalOptions<any, any>,
    ) {
        // @FIXME support for params
        const fullUrl = this._buildUrlBase(givenUrl, fetchOptions.base);
        if (!query) {
            return fullUrl;
        }
        const hasQuery = fullUrl.includes("?");
        const appendChar = hasQuery ? "&" : "?";
        // @todo extract existing query params from string and include for stringify ?
        // @todo add support for string query params

        return fullUrl + appendChar + qs.stringify(query); // @TODO use stringify from deps
    }

    public get<
        U extends keyof RL["get"] & string,
        P extends RL["get"][U]["params"],
        B extends RL["get"][U]["body"],
        Q extends RL["get"][U]["query"],
        H extends RL["get"][U]["headers"],
        D extends RequestData<P, B, Q, H>,
        RT extends ExpectedResponseBodyType = T,
    >(
        url: U, data?: D, options?: RequestOptions<RT, H>,
    ): T extends ExpectedResponseBodyType.json
            ? Promise<ApiResponse<RL["get"][U]["response"]>>
            : Promise<ApiResponse<string>> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return this.request("GET", url, data, options) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    public post<
        U extends keyof RL["post"] & string,
        P extends RL["post"][U]["params"],
        B extends RL["post"][U]["body"],
        Q extends RL["post"][U]["query"],
        H extends RL["post"][U]["headers"],
        D extends RequestData<P, B, Q, H>,
        RT extends ExpectedResponseBodyType = T,
    >(
        url: U, data?: D, options?: RequestOptions<RT, H>,
    ): T extends ExpectedResponseBodyType.json
            ? Promise<ApiResponse<RL["post"][U]["response"]>>
            : Promise<ApiResponse<string>> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,max-len
        return this.request("POST", url, data, options) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    // eslint-disable-next-line max-lines-per-function
    public async request<
        Mthd extends string,
        U extends keyof RL[Lowercase<Mthd>] & string,
        P extends RL[Lowercase<Mthd>][U]["params"],
        B extends RL[Lowercase<Mthd>][U]["body"],
        Q extends RL[Lowercase<Mthd>][U]["query"],
        H extends RL[Lowercase<Mthd>][U]["headers"],
        D extends RequestData<P, B, Q, H>,
        RT extends ExpectedResponseBodyType = T,
    >(
        method: Mthd, url: U, data?: D, options?: RequestOptions<RT, H>,
    ): Promise<T extends ExpectedResponseBodyType.json
            ? ApiResponse<RL[Lowercase<Mthd>][U]["response"]>
            : ApiResponse<string>> {
        // ------------

        const start = Date.now();
        const finalOptions = this._buildFetchOptions(options ?? {}, method, data?.body, data?.headers);
        const finalUrl = this._buildUrl(url, data?.params, data?.query, finalOptions);

        let finalResult: ApiResponse<RL[Lowercase<Mthd>][U]["response"]> | ApiResponse<string>;

        const response = await fetch(finalUrl, finalOptions.fetchOptions);
        const bodyText = await response.text();
        if (finalOptions.responseType === ExpectedResponseBodyType.json) {
            let jsonData: RL[Lowercase<Mthd>][U]["response"] | undefined;
            try {
                jsonData = JSON.parse(bodyText) as RL[Lowercase<Mthd>][U]["response"];
            }
            catch {}

            if (jsonData !== undefined) { // reminder: null is valid JSON
                finalResult = new ApiResponse<RL[Lowercase<Mthd>][U]["response"]>({
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    body: jsonData,
                    request: null,
                });
            }
            else {
                // @TODO throw mismatch
                finalResult = new ApiResponse<RL[Lowercase<Mthd>][U]["response"]>({
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    body: null,
                    rawBody: bodyText,
                    request: null,
                });
            }
        }
        else {
            finalResult = new ApiResponse<RL[Lowercase<Mthd>][U]["response"]>({
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                body: bodyText,
                request: null,
            });
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return finalResult as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    }
}

const createApiClient = <
    RSP extends ApiEndpoints, T extends ExpectedResponseBodyType = ExpectedResponseBodyType.json,
>(options: Options<T, GenericHeaders>, dependencies?: ApiClientConfig) => {
    return new ApiClient<T, RSP>(options);
};

export {
    createApiClient,
};
