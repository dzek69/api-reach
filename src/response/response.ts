import type { Headers as NodeFetchHeaders } from "node-fetch";
import type { ApiRequest } from "../request/request";

interface ApiResponseData<Bd> {
    status: number;
    statusText: string;
    headers: NodeFetchHeaders;
    request: ApiRequest;
    body: Bd;
    rawBody?: string;
}

class ApiResponse<Bd> {
    /**
     * HTTP status code
     */
    public readonly status: number;

    /**
     * HTTP status text
     */
    public readonly statusText: string;

    /**
     * Returned headers
     */
    public readonly headers: NodeFetchHeaders;

    /**
     * Request that was sent
     */
    public readonly request: ApiRequest;

    public readonly body: Bd;

    public readonly rawBody?: string;

    // @TODO type?

    public constructor(data: ApiResponseData<Bd>) {
        this.status = data.status;
        this.statusText = data.statusText;
        this.headers = data.headers;
        this.request = data.request;
        this.body = data.body;
        if ("rawBody" in data) {
            this.rawBody = data.rawBody;
        }
    }
}

export {
    ApiResponse,
};
