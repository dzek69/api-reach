/* eslint-disable @typescript-eslint/no-magic-numbers */

import { ResponseStatusGroup } from "../const.js";

const types = {
    // @todo >= 600 as unknown type?
    [ResponseStatusGroup.Aborted]: (status: number) => !status || status === 499 || status >= 600,
    [ResponseStatusGroup.Informational]: (status: number) => status >= 100 && status < 200,
    [ResponseStatusGroup.Success]: (status: number) => status >= 200 && status < 300,
    [ResponseStatusGroup.Redirect]: (status: number) => status >= 300 && status < 400,
    [ResponseStatusGroup.ClientError]: (status: number) => status >= 400 && status < 499, // 499 is intentional here
    [ResponseStatusGroup.ServerError]: (status: number) => status >= 500 && status < 600,
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

const matchStatus = (status: number) => {
    for (let i = 0; i < typesCount; i++) {
        const type = checkOrder[i];
        const fn = types[type];
        if (fn(status)) {
            return type;
        }
    }
    throw new Error("Unknown HTTP status"); // @TODO throw custom error with some details
};

export {
    matchStatus,
};
