enum ResponseStatusGroup {
    // @TODO match key to value ?
    Aborted = "aborted",
    Informational = "informational",
    Success = "success",
    Redirect = "redirect",
    ClientError = "clientError",
    ServerError = "serverError",
}

/**
 * Body type we expect to receive
 */
enum ExpectedResponseBodyType {
    json = "json",
    text = "text",
    binary = "binary",
    stream = "stream",
}

/**
 * Body type that can be sent
 */
enum RequestBodyType {
    /**
     * Body should be a plain object or stringified JSON (this won't be validated)
     * Appropriately sets Content-Type header
     */
    json = "json",
    /**
     * Body should be a plain object or stringified URL-encoded data (this won't be validated)
     * Appropriately sets Content-Type header
     */
    urlencoded = "urlencoded",
    /**
     * Body should be a string
     * No Content-Type header will be set
     */
    plain = "plain", // @TODO should accept only stringified body
    /**
     * Body should be a FormData object
     * Appropriately sets Content-Type header
     */
    formData = "formData",
    // @TODO stream = "stream", ?
}

/**
 * Maps body type to Content-Type header we need to add
 */
const requestContentTypeMap: Record<RequestBodyType, string | null> = {
    json: "application/json; charset=utf-8",
    urlencoded: "application/x-www-form-urlencoded",
    plain: null,
    formData: null, // fetch will set it automatically
} as const;

export { ResponseStatusGroup, ExpectedResponseBodyType, RequestBodyType, requestContentTypeMap };
