import type stream from "stream";

import { DownloadError } from "./errors.js";
import type { ApiClient } from "./api-client.js";
import { RequestType } from "./const.js";
import type { Data, Options, ResponseDataStream, URLArgument } from "./types";

/**
 * Downloads a file into writable stream
 *
 * @param {stream.Writable} writableStream
 * @param {ApiClient} api
 * @param {string} method - method to use
 * @param {string} url - absolute url or relative that will be joined with base url
 * @param {Object|null} [queryParams] - query params that will be added to `url`
 * @param {string|Object} [body] - request body. Used as-is when string or stringified according to given data
 * `type` when Object
 * @param {Options} [options] - options that will override defaults and options specified in the constructor
 * @returns {Promise<Response>}
 */
const download = async (
    writableStream: stream.Writable,
    api: ApiClient,
    method: string,
    url: URLArgument,
    queryParams?: Data | null,
    body?: Data | null,
    options?: Options | null,
) => {
    const res = await api.request(method, url, queryParams, body, {
        ...options,
        type: RequestType.stream,
    });

    return new Promise<typeof res>((resolve, reject) => {
        const resBody = (res.body as ResponseDataStream["body"])!;
        resBody.pipe(writableStream);
        resBody.on("error", (err) => {
            reject(new DownloadError(err));
        });
        writableStream.on("finish", () => {
            resolve(res);
        });
    });
};

export {
    download,
};
