import { createError } from "better-custom-error";

import type { ApiResponse } from "./response/response";
import type { RequestType } from "./const";
import type { AbortErrorDetails } from "./types";

/**
 * Base/generic error type
 *
 * @class Error
 * @property {string} message - error message
 * @property {Object} details - error details
 * @property {string} stack - stack trace
 */

interface ErrorDetails {
    response: ApiResponse;
    [key: string]: unknown;
}

interface TypeMismatchDetails extends ErrorDetails {
    expectedType: RequestType;
}

/**
 * Non-success response custom error
 *
 * @class HttpError
 * @extends Error
 */
const HttpError = createError<ErrorDetails>("HttpError");
/**
 * Response 4xx error
 *
 * @class ClientHttpError
 * @extends HttpError
 * @extends Error
 */
const ClientHttpError = createError<ErrorDetails>("ClientHttpError", HttpError);
/**
 * Response 5xx error
 *
 * @class ServerHttpError
 * @extends HttpError
 * @extends Error
 */
const ServerHttpError = createError<ErrorDetails>("ServerHttpError", HttpError);
/**
 * Response timeout error
 *
 * @class TimeoutHttpError
 * @extends ServerHttpError
 * @extends HttpError
 * @extends Error
 */
const TimeoutHttpError = createError<AbortErrorDetails>("TimeoutHttpError", ServerHttpError);
/**
 * Response aborted error
 *
 * @class AbortedHttpError
 * @extends ServerHttpError
 * @extends HttpError
 * @extends Error
 */
const AbortedHttpError = createError<AbortErrorDetails>("AbortedHttpError", ClientHttpError);
/**
 * Response data type was different than expected
 *
 * @class ResponseDataTypeMismatchError
 * @extends Error
 */
const ResponseDataTypeMismatchError = createError<TypeMismatchDetails>("ResponseDataTypeMismatchError");
/**
 * Downloading failed during stream
 *
 * @class DownloadError
 * @extends Error
 */
const DownloadError = createError<ErrorDetails>("DownloadError");

type PossibleErrors = typeof ClientHttpError
    | typeof ServerHttpError
    | typeof TimeoutHttpError
    | typeof AbortedHttpError
    | typeof ResponseDataTypeMismatchError
    | typeof DownloadError;

export {
    HttpError,
    ClientHttpError,
    ServerHttpError,
    TimeoutHttpError,
    AbortedHttpError,
    ResponseDataTypeMismatchError,
    DownloadError,
};

export type {
    ErrorDetails,
    TypeMismatchDetails,
    PossibleErrors,
};
