import urlJoin from "url-join";

const getJoinedUrl = (url: string | string[]) => {
    if (Array.isArray(url)) {
        return urlJoin(...url);
    }
    return url;
};

// eslint-disable-next-line no-promise-executor-return
const wait = async (time: number) => new Promise(resolve => setTimeout(resolve, time));

const FUNCTION_NAME_BEGIN_INDEX = 11;
const FUNCTION_NAME_END_INDEX = -1;

const getFunctionNameFromString = (s: string) => {
    return s.substring(FUNCTION_NAME_BEGIN_INDEX, s.length + (FUNCTION_NAME_END_INDEX - 1));
};

const createNoopFunctionFromString = (s: string) => {
    const name = getFunctionNameFromString(s);
    const fn = () => undefined;
    Object.defineProperty(fn, "name", { value: name });
    return fn;
};

export {
    getJoinedUrl,
    wait,
    createNoopFunctionFromString,
};
