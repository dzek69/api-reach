import type { Response as NodeFetchResponse, Headers as NodeFetchHeaders } from "node-fetch";
import type { RequestType } from "../const.js";
import type { ApiRequest } from "../request/request.js";
import type { FetchLikeData, ResponseData } from "../types.js";

import { ResponseStatusGroup } from "../const.js";

import { matchStatus } from "./matchStatus.js";
import decodeData from "./decodeData.js";

/**
 * @class ApiResponse
 * @property {number} status - response status
 * @property {string} statusText - response status text
 * @property {Object} headers - response headers
 * @property {Request} request - request that was send
 * @property {Object|string} body - response body
 * @property {string} type - response type
 * @property {Object|string} [rawBody] - response body as string, when it couldn't be decoded from expected JSON
 */
class ApiResponse {
    public readonly status: number;

    public readonly statusText: string;

    public readonly headers: NodeFetchHeaders;

    public readonly request: ApiRequest;

    public readonly body: ResponseData<unknown>["body"];

    public readonly rawBody?: string;

    public readonly type: RequestType;

    public constructor(result: FetchLikeData, data: ResponseData<unknown>, request: ApiRequest) {
        this.status = result.status;
        this.statusText = result.statusText;
        this.headers = result.headers;
        this.request = request;

        this.body = data.body;
        if ("rawBody" in data) {
            this.rawBody = data.rawBody;
        }
        this.type = data.type;
    }
}

class AbortedResponse extends ApiResponse {}
class InformationalResponse extends ApiResponse {}
class SuccessResponse extends ApiResponse {}
class RedirectResponse extends ApiResponse {}
class ClientErrorResponse extends ApiResponse {}
class ServerErrorResponse extends ApiResponse {}

const createResponseWithData = <Format>(
    result: FetchLikeData, type: RequestType, request: ApiRequest, data: ResponseData<Format>,
) => {
    const statusType = matchStatus(result.status);

    if (statusType === ResponseStatusGroup.Aborted) {
        return new AbortedResponse(result, data, request);
    }
    if (statusType === ResponseStatusGroup.Informational) {
        return new InformationalResponse(result, data, request);
    }
    if (statusType === ResponseStatusGroup.Success) {
        return new SuccessResponse(result, data, request);
    }
    if (statusType === ResponseStatusGroup.Redirect) {
        return new RedirectResponse(result, data, request);
    }
    if (statusType === ResponseStatusGroup.ClientError) {
        return new ClientErrorResponse(result, data, request);
    }
    return new ServerErrorResponse(result, data, request);
};

const createResponse = async <Format>(result: NodeFetchResponse, type: RequestType, request: ApiRequest) => {
    const data = await decodeData<Format>(result, type);
    return createResponseWithData<Format>(result, type, request, data);
};

type Await<T> = T extends Promise<infer U> ? U : T;

type PossibleResponses = Await<ReturnType<typeof createResponse>>;
type PossibleNonErrorResponses = InformationalResponse | SuccessResponse | RedirectResponse;
type PossibleErrorResponses = AbortedResponse | ClientErrorResponse | ServerErrorResponse;

export {
    createResponse,
    createResponseWithData,
    ApiResponse,
    AbortedResponse,
    InformationalResponse,
    SuccessResponse,
    RedirectResponse,
    ClientErrorResponse,
    ServerErrorResponse,
};

export type {
    PossibleResponses,
    PossibleNonErrorResponses,
    PossibleErrorResponses,
};
