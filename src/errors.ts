/* eslint-disable @typescript-eslint/no-redeclare */

import { createError } from "@ezez/errors";

import type { GenericBody, GenericHeaders, GenericJSONResponse, GenericParams, GenericQuery } from "./types";
import type { ExpectedResponseBodyType, RequestBodyType } from "./const";
import type { ApiResponse } from "./response/response";

type BasicErrorDetails<
    Mthd extends string, U extends string,
    P extends GenericParams, B extends GenericBody,
    BT extends RequestBodyType | undefined, Q extends GenericQuery,
    H extends GenericHeaders, RB extends GenericJSONResponse | string,
    RT extends ExpectedResponseBodyType,
> = {
    response: ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT>;
};

type AbortErrorDetails = {
    tries: number;
    while: "waiting" | "connection";
};

/**
 * Generic Api error
 */
const ApiReachError = createError("ApiReachError");
type ApiReachError = ReturnType<typeof ApiReachError>;

/**
 * Unknown error, should never be thrown, only if something super unexpected happens
 */
const UnknownError = ApiReachError.extend("UnknownError");
type UnknownError = ReturnType<typeof UnknownError>;

/**
 * Error thrown when the request is aborted
 */
const AbortError = ApiReachError.extend<AbortErrorDetails>("AbortError");
type AbortError = ReturnType<typeof AbortError>;

/**
 * Error thrown when the request times out
 */
const TimeoutError = ApiReachError.extend<AbortErrorDetails>("TimeoutError");
type TimeoutError = ReturnType<typeof TimeoutError>;

/**
 * Generic HTTP error, will never be thrown directly
 */
const HttpError = ApiReachError.extend<
BasicErrorDetails<any, any, any, any, any, any, any, any, any>
>("HttpError");
type HttpError = ReturnType<typeof HttpError>;

/**
 * HTTP error, thrown on 4xx status codes
 */
const HttpClientError = HttpError.extend("HttpClientError");
type HttpClientError = ReturnType<typeof HttpClientError>;

/**
 * HTTP error, thrown on 5xx status codes
 */
const HttpServerError = HttpError.extend("HttpServerError");
type HttpServerError = ReturnType<typeof HttpServerError>;

/**
 * Error thrown when the response data type does not match the expected type
 * It's thrown even if the request is a success
 */
const ResponseDataTypeMismatchError = createError<
BasicErrorDetails<any, any, any, any, any, any, any, any, any> & {
    expectedType: ExpectedResponseBodyType;
}
>("ResponseDataTypeMismatchError");
type ResponseDataTypeMismatchError = ReturnType<typeof ResponseDataTypeMismatchError>;

export type { AbortErrorDetails };
export {
    ApiReachError, AbortError, TimeoutError, UnknownError,
    HttpError, HttpClientError, HttpServerError,
    ResponseDataTypeMismatchError,
};
