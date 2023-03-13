import type { ApiResponse } from "../response/response";
import type { ExpectedResponseBodyType, RequestBodyType } from "../const";
import type { GenericBody, GenericHeaders, GenericJSONResponse, GenericParams, GenericQuery } from "./common";

type AR = ApiResponse<
"", "", GenericParams, GenericBody, RequestBodyType, GenericQuery,
GenericHeaders, GenericJSONResponse | string, ExpectedResponseBodyType
>;

interface CachedData {
    status: AR["status"];
    statusText: AR["statusText"];
    headers: AR["headers"];
    body: AR["body"];
}

export type {
    CachedData,
};
