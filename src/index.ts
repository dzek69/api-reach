interface ApiClientConfig {
    fetch: typeof fetch;
    URL: typeof URL;
    AbortController: typeof AbortController;
}

type ResponseType = "json" | "text";
type Coalesce<T, K> = T extends undefined ? K : T;

type ResponsesListType = Record<string, Record<string, Record<string, unknown>>>;

type ResponsesList = {
    "get": {
        "/users": {
            status: 400;
        };
    };
    "post": {
        "/delete": {
            status: 404;
        };
    };
};

const createApiClient = (config: ApiClientConfig) => {

};

interface Opts<RT extends ResponseType> {
    type?: RT;
}

type FetchResponseType<T extends "text" | "json"> =
    T extends "text" ? string :
        T extends "json" ? Record<string, string> :
            never;

class ApiClient<T extends ResponseType, RL extends ResponsesListType> {
    public request<U extends keyof RL["get"], RT extends ResponseType = T>(
        url: U, options?: Opts<RT>,
    ): T extends "json" ? Promise<RL["get"][U]> : Promise<string> {
        return "";
    }
}

const x = new ApiClient<"json", ResponsesList>();
const data = x.request("/users", { type: "json" });

export {
    createApiClient,
};
