import type { ApiRequest } from "../request/request";
import type { GenericBody, GenericHeaders, GenericJSONResponse, GenericParams, GenericQuery } from "../types";
import type { ExpectedResponseBodyType, RequestBodyType } from "../const";

import { ResponseStatusGroup } from "../const.js";
import { matchStatus } from "../utils.js";

interface ApiResponseData<
    Mthd extends string, U extends string,
    P extends GenericParams, B extends GenericBody,
    BT extends RequestBodyType | undefined, Q extends GenericQuery,
    H extends GenericHeaders, RB extends GenericJSONResponse | string | ReadableStream<Uint8Array> | undefined,
    RT extends ExpectedResponseBodyType,
> {
    status: number;
    statusText: string;
    headers: GenericHeaders;
    request: ApiRequest<Mthd, U, P, B, BT, Q, H, RT>;
    body: RB;
}

class ApiResponse<
    Mthd extends string, U extends string,
    P extends GenericParams, B extends GenericBody,
    BT extends RequestBodyType | undefined, Q extends GenericQuery,
    H extends GenericHeaders, RB extends GenericJSONResponse | string | ReadableStream<Uint8Array> | undefined,
    RT extends ExpectedResponseBodyType,
> {
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
    public readonly headers: GenericHeaders;

    /**
     * Request that was sent
     */
    public readonly request: ApiRequest<Mthd, U, P, B, BT, Q, H, RT>;

    /**
     * Body received
     *
     * It will be a forced string if request return type mismatch happened!
     */
    public readonly body: RB;

    public readonly cached: boolean = false;

    // @TODO type?

    public constructor(data: ApiResponseData<Mthd, U, P, B, BT, Q, H, RB, RT>, cached: boolean = false) {
        this.status = data.status;
        this.statusText = data.statusText;
        this.headers = data.headers;
        this.request = data.request;
        this.body = data.body;
        this.cached = cached;
    }
}

class AbortedResponse<
    Mthd extends string, U extends string,
    P extends GenericParams, B extends GenericBody,
    BT extends RequestBodyType | undefined, Q extends GenericQuery,
    H extends GenericHeaders, RB extends GenericJSONResponse | string | ReadableStream<Uint8Array> | undefined,
    RT extends ExpectedResponseBodyType,
> extends ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT> {}

class InformationalResponse<
    Mthd extends string, U extends string,
    P extends GenericParams, B extends GenericBody,
    BT extends RequestBodyType | undefined, Q extends GenericQuery,
    H extends GenericHeaders, RB extends GenericJSONResponse | string | ReadableStream<Uint8Array> | undefined,
    RT extends ExpectedResponseBodyType,
> extends ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT> {}

class SuccessResponse<
    Mthd extends string, U extends string,
    P extends GenericParams, B extends GenericBody,
    BT extends RequestBodyType | undefined, Q extends GenericQuery,
    H extends GenericHeaders, RB extends GenericJSONResponse | string | ReadableStream<Uint8Array> | undefined,
    RT extends ExpectedResponseBodyType,
> extends ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT> {}

class RedirectResponse<
    Mthd extends string, U extends string,
    P extends GenericParams, B extends GenericBody,
    BT extends RequestBodyType | undefined, Q extends GenericQuery,
    H extends GenericHeaders, RB extends GenericJSONResponse | string | ReadableStream<Uint8Array> | undefined,
    RT extends ExpectedResponseBodyType,
> extends ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT> {}

class ClientErrorResponse<
    Mthd extends string, U extends string,
    P extends GenericParams, B extends GenericBody,
    BT extends RequestBodyType | undefined, Q extends GenericQuery,
    H extends GenericHeaders, RB extends GenericJSONResponse | string | ReadableStream<Uint8Array> | undefined,
    RT extends ExpectedResponseBodyType,
> extends ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT> {}

class ServerErrorResponse<
    Mthd extends string, U extends string,
    P extends GenericParams, B extends GenericBody,
    BT extends RequestBodyType | undefined, Q extends GenericQuery,
    H extends GenericHeaders, RB extends GenericJSONResponse | string | ReadableStream<Uint8Array> | undefined,
    RT extends ExpectedResponseBodyType,
> extends ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT> {}

const createResponse = <
    Mthd extends string, U extends string,
    P extends GenericParams, B extends GenericBody,
    BT extends RequestBodyType | undefined, Q extends GenericQuery,
    H extends GenericHeaders, RB extends GenericJSONResponse | string | ReadableStream<Uint8Array> | undefined,
    RT extends ExpectedResponseBodyType,
>(data: ApiResponseData<Mthd, U, P, B, BT, Q, H, RB, RT>, cached = false) => {
    const responseType = matchStatus(data.status);
    if (responseType === ResponseStatusGroup.Informational) {
        return new InformationalResponse(data, cached);
    }
    if (responseType === ResponseStatusGroup.Success) {
        return new SuccessResponse(data, cached);
    }
    if (responseType === ResponseStatusGroup.Redirect) {
        return new RedirectResponse(data, cached);
    }
    if (responseType === ResponseStatusGroup.ClientError) {
        return new ClientErrorResponse(data, cached);
    }
    if (responseType === ResponseStatusGroup.ServerError) {
        return new ServerErrorResponse(data, cached);
    }

    return new AbortedResponse(data, cached);
};

export {
    ApiResponse,
    AbortedResponse,
    InformationalResponse,
    SuccessResponse,
    RedirectResponse,
    ClientErrorResponse,
    ServerErrorResponse,

    createResponse,
};
