import { parse } from "content-disposition";
import { extension } from "mime-types";

import type { ExpectedResponseBodyType, RequestBodyType } from "./const";
import type { ApiRequest } from "./request/request";
import type { ApiResponse } from "./response/response";
import type { GenericBody, GenericHeaders, GenericJSONResponse, GenericParams, GenericQuery } from "./types";

/**
 * Extracts the file name from a given URL.
 *
 * @param url - The URL string to extract the file name from.
 * @returns The extracted file name or the hostname if no file name is present.
 */
const getFileNameFromUrl = (url: string): string => {
    const u = new URL(url);
    return u.pathname.split("/").pop() ?? u.hostname;
};

/**
 * Extracts the filename from the "Content-Disposition" header if available.
 *
 * @param headers - The headers object containing HTTP headers.
 * @returns The extracted filename if present, otherwise null.
 */
const getFileNameFromHeaders = (headers: NonNullable<GenericHeaders>): string | null => {
    const contentDisposition = headers["content-disposition"];
    if (!contentDisposition) {
        return null;
    }
    const p = parse(contentDisposition);
    return p.parameters.filename ?? null;
};

/**
 * Determines the file extension from the "content-type" field in the provided headers.
 *
 * @param headers - The headers object containing the "content-type" information.
 * @returns The file extension derived from the content type, or null if it cannot be determined.
 */
const getExtensionFromHeaders = (headers: NonNullable<GenericHeaders>): string | null => {
    const contentType = headers["content-type"];
    if (!contentType) {
        return null;
    }
    return extension(contentType) || null;
};

/**
 * Extracts and returns the file name from the URL of the given API request object.
 *
 * @param request The API request object containing the URL to extract the file name from.
 * @returns The file name extracted from the URL.
 */
const getFileNameFromRequest = <
    Mthd extends string, U extends string,
    P extends GenericParams, B extends GenericBody,
    BT extends RequestBodyType | undefined, Q extends GenericQuery,
    H extends GenericHeaders, RT extends ExpectedResponseBodyType,
>(
    request: ApiRequest<Mthd, U, P, B, BT, Q, H, RT>,
): string => {
    const { fullUrl } = request;
    return getFileNameFromUrl(fullUrl);
};

/**
 * Extracts the file name from an API response by inspecting the "Content-Disposition" header or using request url
 * if Content-Disposition is not present.
 *
 * @param response - The API response object containing headers and request metadata.
 * @returns The extracted file name.
 */
const getFileNameFromResponse = <
    Mthd extends string, U extends string,
    P extends GenericParams, B extends GenericBody,
    BT extends RequestBodyType | undefined, Q extends GenericQuery,
    H extends GenericHeaders, RB extends GenericJSONResponse | string | ReadableStream<Uint8Array> | undefined,
    RT extends ExpectedResponseBodyType,
>(response: ApiResponse<Mthd, U, P, B, BT, Q, H, RB, RT>): string => {
    const disposition = response.headers?.["content-disposition"];
    if (!disposition) {
        return getFileNameFromRequest(response.request);
    }
    const p = parse(disposition);
    return p.parameters.filename ?? getFileNameFromRequest(response.request);
};

export {
    getFileNameFromUrl,
    getFileNameFromHeaders,
    getExtensionFromHeaders,
    getFileNameFromRequest,
    getFileNameFromResponse,
};
