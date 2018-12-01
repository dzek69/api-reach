import fetch from "node-fetch";
import { ClientHttpError, ServerHttpError, ResponseDataTypeMismatchError } from "./errors";
import createResponse from "./response";
import { isServerError, isClientError } from "./response/matchStatus";
import Request from "./request";

// Types:
// text
// json
// raw (binary)

/**
 * @typedef {Object} ApiOptions
 * @property {string} type - expected data type
 */

const contentTypeMap = {
    json: "application/json; charset=utf-8",
    text: "application/x-www-form-urlencoded",
};

// const optionsWhitelist = [
//     "method",
//     "mode",
//     "cache",
//     "credentials",
//     "headers",
//     "redirect",
//     "referrer",
//     "body",
// ];

/**
 * @class ApiClient
 */
class ApiClient {
    /**
     * @param {ApiOptions} options
     */
    constructor(options) {
        this._options = options || {};
    }

    _getType(options) {
        return options.type || this._options.type || "json"; // @todo do not hardcode type here
    }

    _getContentType(options) {
        const type = this._getType(options);
        return contentTypeMap[type]; // @todo handle unknown type
    }

    _getBody(options, body) {
        const type = this._getType(options);
        if (type === "json") {
            return JSON.stringify(body);
        }
        if (type === "text") {
            if (typeof body === "string") {
                return body;
            }
            return ""; // @todo serialize body
        }
        return ""; // @todo throw?
    }

    _buildFetchOptions(options, body) {
        const globalHeaders = this._options.headers;
        const localHeaders = options.headers;

        const contentType = {};
        const bodyOptions = {};
        if (body != null) {
            contentType["Content-Type"] = this._getContentType(options);
            bodyOptions.body = this._getBody(options, body);
        }

        return { // @todo filter only known options
            ...this._options,
            ...options,
            ...bodyOptions,
            headers: {
                ...globalHeaders, // @todo handle same header but with different case
                ...localHeaders, // @todo handle multiple headers
                ...contentType,
            },
        };
    }

    get(url, queryParams, options) {
        return this.request("GET", url, queryParams, null, options);
    }

    async request(method, originalUrl, queryParams, body, options) {
        const fetchOptions = {
            ...this._buildFetchOptions(options || {}, body),
            method: method.toUpperCase(),
        };

        const url = originalUrl; // @todo use queryParams here to create url

        const request = new Request(url, fetchOptions, originalUrl, queryParams);

        const result = await fetch(request.url, request.options);

        const type = this._getType(options || {});
        const response = await createResponse(result, type, request);
        if ("rawBody" in response) {
            throw new ResponseDataTypeMismatchError("Unexpected type of data received", {
                response: response,
                expectedType: type,
            });
        }

        if (isClientError(result.status)) {
            throw new ClientHttpError(result.statusText, {
                response,
            });
        }

        if (isServerError(result.status)) {
            throw new ServerHttpError(result.statusText, {
                response,
            });
        }
        return response;
    }
}

export default ApiClient;
