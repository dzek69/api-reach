import { DownloadError } from "./errors.mjs";

/**
 * Downloads a file into writable stream
 *
 * @param {ApiClient} api
 * @param {string} method - method to use
 * @param {string} url - absolute url or relative that will be joined with base url
 * @param {Object|null} [queryParams] - query params that will be added to `url`
 * @param {string|Object} [body] - request body. Used as-is when string or stringified according to given data
 * `type` when Object
 * @param {ApiOptions} [options] - options that will override defaults and options specified in the constructor
 * @param {stream.Writable} writableStream
 * @returns {Promise<Response>}
 */
const download = async (api, method, url, queryParams, body, options, writableStream) => {
    const res = await api.request(method, url, queryParams, body, {
        ...options,
        type: "stream",
    });

    return new Promise((resolve, reject) => {
        res.body.pipe(writableStream);
        res.body.on("error", (err) => {
            reject(new DownloadError(err));
        });
        writableStream.on("finish", () => {
            resolve(res);
        });
    });
};

export default {
    download,
};
