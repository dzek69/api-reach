import stream from "stream";

import { Timeout } from "oop-timers";

import type { ApiClient } from "./index";

import { ExpectedResponseBodyType } from "./const.js";
import { ApiReachError } from "./errors";

const DATA_TIMEOUT = 5000;
const FINISH_TIMEOUT = 3000;

const DownloadError = ApiReachError.extend("DownloadError");
// eslint-disable-next-line @typescript-eslint/no-redeclare
type DownloadError = ReturnType<typeof DownloadError>;

let x = 0;

/**
 * Downloads a file into writable stream
 *
 * @param writableStream
 * @param api
 * @param method - method to use
 * @param url - absolute url or relative that will be joined with base url
 * @param [query] - query params that will be added to `url`
 * @param [body] - request body. Used as-is when string or stringified according to given data
 * `type` when Object
 * @param [options] - options that will override defaults and options specified in the constructor
 * @returns
 */
const download = async <Client extends ApiClient<ExpectedResponseBodyType.stream, any>>( // eslint-disable-line max-lines-per-function,max-len,@typescript-eslint/no-explicit-any
    writableStream: stream.Writable,
    api: Client,
    method: string,
    url: string,
    query?: Parameters<Client["get"]>[1]["query"],
    body?: Parameters<Client["get"]>[1]["body"],
    options?: Parameters<Client["get"]>[2] | null,
) => {
    // @ts-expect-error this is not strongly typed
    const res = await api.request(method, url, { query, body }, {
        ...options,
        responseType: ExpectedResponseBodyType.stream,
    });

    // eslint-disable-next-line max-lines-per-function
    return new Promise<typeof res>((resolve, reject) => {
        x++;
        const id = x;
        // @ts-expect-error TS not happy, let's ignore
        const resBody = stream.Readable.fromWeb(res.body);

        let finished = false;
        const safeResolve: typeof resolve = (value) => {
            // eslint-disable-next-line no-console
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
            // eslint-disable-next-line no-console
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
            reject(new DownloadError("Error happened during download", null, err));
        });

        resBody.on("end", () => {
            finishTimeoutTimer.start();
            dataTimeoutTimer.stop();
            // eslint-disable-next-line no-console
            console.log(id, "READ STREAM ENDED");
        });
        writableStream.on("finish", () => {
            // eslint-disable-next-line no-console
            console.log(id, "WRITE STREAM ENDED");
            finishTimeoutTimer.stop();
            safeResolve(res);
        });
    });
};

export {
    download,
};
