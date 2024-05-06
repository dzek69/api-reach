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
    json = "json",
    urlencoded = "urlencoded",
    plain = "plain", // @TODO should accept only stringified body
    // @TODO binary = "binary", // or file?
    // @TODO stream = "stream",
}

/**
 * Maps body type to sent content type
 */
const contentTypeMap = {
    json: "application/json; charset=utf-8",
    text: "application/x-www-form-urlencoded",
    binary: null,
    stream: null,
} as const;

export { ResponseStatusGroup, ExpectedResponseBodyType, RequestBodyType, contentTypeMap };
