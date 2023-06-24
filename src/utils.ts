/* eslint-disable @typescript-eslint/no-magic-numbers */

import { ResponseStatusGroup } from "./const.js";

// Note: 0, 499 and
// 499 is non-standard, but very popular nginx error code
// @TODO make it configurable? because 499 probably will never reach the client anyway?
// @TODO make >= 600 as unknown type?

const types = {
    [ResponseStatusGroup.Success]: (status: number) => status >= 200 && status < 300,
    [ResponseStatusGroup.ClientError]: (status: number) => status >= 400 && status < 499, // 499 is intentional here
    [ResponseStatusGroup.ServerError]: (status: number) => status >= 500 && status < 600,
    [ResponseStatusGroup.Redirect]: (status: number) => status >= 300 && status < 400,
    [ResponseStatusGroup.Aborted]: (status: number) => !status || status === 499,
    [ResponseStatusGroup.Informational]: (status: number) => status >= 100 && status < 200,
};

const checkOrder = [
    ResponseStatusGroup.Success,
    ResponseStatusGroup.ClientError,
    ResponseStatusGroup.ServerError,
    ResponseStatusGroup.Redirect,
    ResponseStatusGroup.Aborted,
    ResponseStatusGroup.Informational,
];
const typesCount = checkOrder.length;

/**
 * Matches HTTP status code to the type group
 * @param {number} status - HTTP status code
 */
const matchStatus = (status: number) => {
    for (let i = 0; i < typesCount; i++) {
        const type = checkOrder[i];
        const fn = types[type];
        if (fn(status)) {
            return type;
        }
    }

    // @TODO throw custom error with some details
    // this could only happen on things like negative codes etc
    throw new Error("Unknown HTTP status");
};

export {
    matchStatus,
};
