enum ResponseStatusGroup {
    Aborted = "aborted",
    Informational = "informational",
    Success = "success",
    Redirect = "redirect",
    ClientError = "clientError",
    ServerError = "serverError",
}

enum RequestType {
    json = "json",
    text = "text",
    binary = "binary",
    stream = "stream",
}

const contentTypeMap = {
    json: "application/json; charset=utf-8",
    text: "application/x-www-form-urlencoded",
    binary: null,
    stream: null,
} as const;

export { ResponseStatusGroup, contentTypeMap, RequestType };
