import stream from "stream";

import { DownloadError } from "./errors.js";
import type { ApiClient } from "./api-client.js";
import { RequestType } from "./const.js";
import type { Data, Options, ResponseDataStream, URLArgument } from "./types";
import { Timeout } from "oop-timers";

const DATA_TIMEOUT = 5000;
const FINISH_TIMEOUT = 3000;

let x = 0;

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
const download = async ( // eslint-disable-line max-lines-per-function
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
        x++;
        const id = x;
        const resBody = (res.body as ResponseDataStream["body"])!;

        let finished = false;
        const safeResolve: typeof resolve = (value) => {
            console.log(id, "resolving");
            if (finished) {
                // eslint-disable-next-line no-console
                console.trace(id, "Called resolve on already finished promise");
                return;
            }
            finished = true;
            resolve(value);
        };
        const safeReject: typeof reject = (value) => {
            console.log(id, "rejecting");
            if (finished) {
                // eslint-disable-next-line no-console
                console.trace(id, "Called reject on already finished promise");
                return;
            }
            finished = true;
            reject(value);
        };

        const dataTimeoutTimer = new Timeout(
            () => { safeReject(new Error("Readable stream timeout")); }, DATA_TIMEOUT, false,
        );
        const finishTimeoutTimer = new Timeout(
            () => { safeReject(new Error("Writable stream not finished after readable did")); }, FINISH_TIMEOUT, false,
        );

        const timeoutCheck = new stream.Writable({
            // eslint-disable-next-line no-undef
            write(chunk: unknown, encoding: BufferEncoding, callback: (error?: (Error | null)) => void) {
                dataTimeoutTimer.start();
                callback(null);
            },
        });
        resBody.pipe(timeoutCheck);
        resBody.pipe(writableStream);
        resBody.on("error", (err) => {
            reject(new DownloadError(err));
        });

        resBody.on("end", () => {
            finishTimeoutTimer.start();
            dataTimeoutTimer.stop();
            console.log(id, "READ STREAM ENDED");
        });
        writableStream.on("finish", () => {
            console.log(id, "WRITE STREAM ENDED");
            finishTimeoutTimer.stop();
            safeResolve(res);
        });
    });
};

export {
    download,
};
