import fetch from "light-isomorphic-fetch"; // eslint-disable-line max-lines
import qs from "qs";
import urlJoin from "url-join";
import AbortController from "isomorphic-abort-controller";
import Timeout from "oop-timers/src/Timeout";
const stringify = qs.stringify;

import { ClientHttpError, ServerHttpError, ResponseDataTypeMismatchError, AbortedHttpError } from "./errors";
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
let URLParser = URL;

const safeUrlParse = (url) => {
    try {
        return new URLParser(url);
    }
    catch (e) { // eslint-disable-line no-unused-vars
        return null;
    }
};

const globalOptions = { // eslint-disable-line object-shorthand
    retry: 1,
    retryInterval: 100,
    retryPolicy({ count }) {
        return count <= this.retry;
    },
    retryWaitPolicy() {
        return this.retryInterval;
    },
    timeout: 30000,
    totalTimeout: 60000,
};

const wait = time => new Promise(resolve => setTimeout(resolve, time));

const noop = () => undefined;

/**
 * @class ApiClient
 */
class ApiClient {
    /**
     * @param {ApiOptions} options
     */
    constructor(options) {
        // @todo validate them?
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
            return stringify(body);
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
            ...globalOptions,
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

    _buildUrlBase(url, base) {
        const parsedBase = safeUrlParse(base);
        if (!parsedBase || !parsedBase.host) { // @todo throw an Error ?
            return url;
        }

        const parsedUrl = safeUrlParse(url);
        if (parsedUrl && parsedUrl.base) { // base is valid full url and given url is also full url
            throw new Error("Cannot use absolute url with base url."); // @todo throw custom type?
        }

        return urlJoin(base, url);
    }

    _buildUrl(originalUrl, queryParams, fetchOptions) {
        const url = this._buildUrlBase(originalUrl, fetchOptions.base);
        if (!queryParams) {
            return url;
        }
        const hasQS = url.includes("?");
        const appendChar = hasQS ? "&" : "?";
        // @todo extract existing query params from string and include for stringify ?

        return url + appendChar + stringify(queryParams);
    }

    get(url, queryParams, options) {
        return this.request("GET", url, queryParams, null, options);
    }

    post(url, queryParams, body, options) {
        return this.request("POST", url, queryParams, body, options);
    }

    patch(url, queryParams, body, options) {
        return this.request("PATCH", url, queryParams, body, options);
    }

    delete(url, queryParams, body, options) {
        return this.request("DELETE", url, queryParams, body, options);
    }

    request(method, originalUrl, queryParams, body, options = {}) { // eslint-disable-line max-lines-per-function
        const start = Date.now();
        const fineOptions = this._buildFetchOptions(options || {}, body);
        let currentController,
            globalTimeout,
            aborted = false,
            isGlobalTimeouted = false;

        const globalBreak = () => {
            isGlobalTimeouted = true;
            future.abort(); // eslint-disable-line no-use-before-define
        };

        const future = new Promise((resolve, reject) => { // eslint-disable-line max-lines-per-function
            let count = 0,
                lastError = null;

            return (async () => { // eslint-disable-line max-statements, max-lines-per-function
                while (fineOptions.retryPolicy({ count: ++count })) {
                    let isTimeouted = false;
                    currentController = new AbortController();
                    const singleTimeout = new Timeout(() => { // eslint-disable-line no-loop-func
                        isTimeouted = true;
                        currentController.abort();
                    }, fineOptions.timeout);
                    try {
                        if (count > 1) {
                            const waitTime = fineOptions.retryWaitPolicy({ count });
                            if (!globalTimeout || fineOptions.totalTimeout > (Date.now() - start) + waitTime) {
                                await wait(waitTime);
                            }
                            else {
                                globalTimeout.stop();
                                globalBreak();
                            }
                        }
                        if (aborted) {
                            const errorDetails = {
                                tries: count - 1,
                                while: "waiting",
                                timeout: isTimeouted,
                                globalTimeout: isGlobalTimeouted,
                            };

                            const msg = `Request aborted ` + JSON.stringify(errorDetails);
                            lastError = new AbortedHttpError(msg, lastError, errorDetails);
                            break;
                        }
                        singleTimeout.start();
                        return await this._request(
                            method, originalUrl, queryParams, body, fineOptions, currentController.signal,
                        );
                    }
                    catch (e) {
                        if (e.name === "AbortError") {
                            const errorDetails = {
                                tries: count,
                                while: "connection",
                                timeout: isTimeouted,
                                globalTimeout: isGlobalTimeouted,
                            };
                            const msg = `Request aborted ` + JSON.stringify(errorDetails);
                            lastError = new AbortedHttpError(msg, lastError, errorDetails);
                            // it should not try again if:
                            // globally timeouted
                            // aborted by user (abort didn't happened via timeout)
                            if (isGlobalTimeouted || !isTimeouted) {
                                break;
                            }
                            continue;
                        }
                        lastError = e;
                    }
                    finally {
                        singleTimeout.stop();
                    }
                }
                throw lastError ? lastError : new Error("No error thrown"); // @todo what to do if no error saved?
            })().then(resolve, reject);
        });
        future.finally(() => {
            globalTimeout && globalTimeout.stop(); // eslint-disable-line no-use-before-define
        }).catch(noop); // noop is required here, as finally is creating new promise branch and throws if errors occurs
        // and each branch should handle error separately (even if that is the same error)

        future.abort = () => {
            aborted = true;
            currentController && currentController.abort();
        };

        if (fineOptions.totalTimeout > 0 && Number.isFinite(fineOptions.totalTimeout)) {
            globalTimeout = new Timeout(globalBreak, fineOptions.totalTimeout, true);
        }

        return future;
    }

    async _request(method, originalUrl, queryParams, body, options, signal) {
        const fetchOptions = {
            ...options,
            method: method.toUpperCase(),
        };

        const url = this._buildUrl(originalUrl, queryParams, fetchOptions);

        const request = new Request(url, fetchOptions, originalUrl, queryParams);

        const result = await fetch(request.url, {
            ...request.options,
            signal,
        });

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
ApiClient.configure = options => {
    URLParser = options.URL;
};

export default ApiClient;
