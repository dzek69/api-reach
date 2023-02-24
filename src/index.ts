import type { RequestData } from "./types";
import type { ApiResponse } from "./response/response";

interface ApiClientConfig {
    fetch: typeof fetch;
    URL: typeof URL;
    AbortController: typeof AbortController;
}

type ApiResponseType = "json" | "text";

type BasicJSONTypes = string | number | boolean | null;
// type JSONFriendly = BasicJSONTypes | JSONFriendly[] | { [key: string]: JSONFriendly };

// This type is a constraint for the ApiClient class, it represents a generic list of responses for methods and urls
type ApiResponsesListType = Record<string, Record<string, {
    response: Record<string, unknown>;
    params?: Record<string, BasicJSONTypes>;
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    headers?: Record<string, string>;
}>>;

interface Opts<RT extends ApiResponseType> {
    type?: RT;
}

class ApiClient<T extends ApiResponseType, RL extends ApiResponsesListType> {
    public request<
        Mthd extends string,
        U extends keyof RL[Lowercase<Mthd>],
        P extends RL[Lowercase<Mthd>][U]["params"],
        B extends RL[Lowercase<Mthd>][U]["body"],
        Q extends RL[Lowercase<Mthd>][U]["query"],
        H extends RL[Lowercase<Mthd>][U]["headers"],
        D extends RequestData<P, B, Q, H>,
        RT extends ApiResponseType = T,
    >(
        method: Mthd, url: U, data?: D, options?: Opts<RT>,
    ): T extends "json" ? Promise<ApiResponse<RL[Lowercase<Mthd>][U]["response"]>> : Promise<ApiResponse<string>> {
        return "";
    }

    // public post<U extends keyof RL["post"], RT extends ApiResponseType = T>(
    //     url: U, options?: Opts<RT>,
    // ): T extends "json" ? Promise<RL["post"][U]> : Promise<string> {
    //     return this.request("POST", url,  options);
    // }
}

type ResponsesList = {
    "get": {
        "/users/:id": {
            response: {
                status: "users";
            };
            params: {
                id: number;
            };
        };
    };
    "post": {
        "/delete": {
            response: {
                status: "delete";
            };
        };
        "/keke": {
            response: {
                status: "keke";
            };
            body: {
                user: number;
            };
            headers: never;
        };
    };
};

const createApiClient = (config: ApiClientConfig) => {

};

const x = new ApiClient<"json", ResponsesList>();
const data = await x.request("POST", "/keke", { body: { user: "1" } });
// const postData = x.post("/keke");

export {
    createApiClient,
};
