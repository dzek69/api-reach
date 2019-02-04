class Request {
    constructor(url, options, originalUrl, queryParams) {
        this.options = options;
        this.url = url;
        this.originalUrl = originalUrl;
        this.queryParams = queryParams;
    }
}

export default Request;
