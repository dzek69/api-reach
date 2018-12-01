import ce from "better-custom-error/dist";
const createError = ce.default;

const HttpError = createError("HttpError");
const ClientHttpError = createError("ClientHttpError", HttpError);
const ServerHttpError = createError("ServerHttpError", HttpError);
const TimeoutHttpError = createError("TimeoutHttpError", ServerHttpError);
const AbortedHttpError = createError("AbortedHttpError", ClientHttpError);
const ResponseDataTypeMismatchError = createError("ResponseDataTypeMismatchError");

export {
    HttpError,
    ClientHttpError,
    ServerHttpError,
    TimeoutHttpError,
    AbortedHttpError,
    ResponseDataTypeMismatchError,
};
