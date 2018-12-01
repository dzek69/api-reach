class Request {
    constructor(url, options, originalUrl, queryParams) {
        Object.assign(this, options);
        this.url = url;
        this.originalUrl = originalUrl;
        this.queryParams = queryParams;
    }
}

export default Request;
