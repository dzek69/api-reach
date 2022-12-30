import type { Response as NodeFetchResponse } from "node-fetch";
import type { ResponseData } from "../types.js";

import { RequestType } from "../const.js";

const decodeData = async <Format>(response: NodeFetchResponse, type: RequestType): Promise<ResponseData<Format>> => {
    if (type === RequestType.json) {
        const text = await response.text();
        try {
            const body = JSON.parse(text) as Format;
            return {
                body,
                type,
            };
        }
        catch (e: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
            // Don't throw here - allow to build proper ApiResponse to attach it to error later
            return {
                body: "",
                rawBody: text,
                type: RequestType.text,
            };
        }
    }

    if (type === RequestType.text) {
        return {
            body: await response.text(),
            type: type,
        };
    }

    if (type === RequestType.binary) {
        return {
            body: await response.buffer(),
            type: type,
        };
    }

    // else: stream
    return {
        body: response.body,
        type: RequestType.stream,
    };
};

// eslint-disable-next-line import/no-default-export
export default decodeData;
