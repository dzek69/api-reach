import urlJoin from "url-join";

const getJoinedUrl = (url: string | string[]) => {
    if (Array.isArray(url)) {
        return urlJoin(...url);
    }
    return url;
};

// eslint-disable-next-line no-promise-executor-return
const wait = async (time: number) => new Promise(resolve => setTimeout(resolve, time));

export {
    getJoinedUrl,
    wait,
};
