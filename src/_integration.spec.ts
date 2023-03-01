import type { HTTPBinAnythingResponse } from "../test/httpbinResponse";

import { ExpectedResponseBodyType } from "./const";
import { AbortError, HttpClientError, HttpError, HttpServerError } from "./errors";

import {
    AbortedResponse,
    ClientErrorResponse,
    createApiClient,
    InformationalResponse,
    RedirectResponse,
    ResponseDataTypeMismatchError,
    ServerErrorResponse,
    SuccessResponse,
} from "./index.js";

type ResponsesList = {
    "get": {
        "/anything/basic": {
            response: HTTPBinAnythingResponse;
        };
        "/anything/advanced": {
            response: HTTPBinAnythingResponse;
            body: never;
            query: {
                page: number;
            };
            headers: {
                custom: string;
            };
        };
        "/users/:id": {
            response: {
                status: "users";
            };
            params: {
                id: number;
            };
        };
    };
    "post": {
        "/anything/advanced": {
            response: HTTPBinAnythingResponse;
            body: {
                title: string;
            };
            query: {
                page: number;
            };
            headers: {
                custom: string;
            };
        };
    };
};

describe("api-reach", () => {
    const api = createApiClient<ResponsesList>({
        base: "http://127.0.0.1:9191", // locally hosted http-bin, see `package.json` scripts
    });

    const textApi = createApiClient({
        base: "http://127.0.0.1:9191",
        responseType: ExpectedResponseBodyType.text,
    });

    it.skip("TS", async () => {
        // const response = await api.get("/anything/advanced");
        // const body = response.request.query;
    });

    describe("creates proper instance", () => {
        it("for success response", async () => {
            const response = await api.get("/anything/basic");
            response.must.not.be.instanceof(InformationalResponse);
            response.must.be.instanceof(SuccessResponse);
            response.must.not.be.instanceof(RedirectResponse);
            response.must.not.be.instanceof(ClientErrorResponse);
            response.must.not.be.instanceof(ServerErrorResponse);
            response.must.not.be.instanceof(AbortedResponse);
        });

        it.skip("for informational response", async () => {
            // http-bin doesn't support 1xx too well
            const response = await textApi.get("/status/100");
            response.must.be.instanceof(InformationalResponse);
            response.must.not.be.instanceof(SuccessResponse);
            response.must.not.be.instanceof(RedirectResponse);
            response.must.not.be.instanceof(ClientErrorResponse);
            response.must.not.be.instanceof(ServerErrorResponse);
            response.must.not.be.instanceof(AbortedResponse);
        });

        it("for redirect response", async () => {
            const response = await textApi.get("/status/303", undefined, {
                fetchOptions: {
                    redirect: "manual",
                },
                responseType: "text",
            });
            response.must.not.be.instanceof(InformationalResponse);
            response.must.not.be.instanceof(SuccessResponse);
            response.must.be.instanceof(RedirectResponse);
            response.must.not.be.instanceof(ClientErrorResponse);
            response.must.not.be.instanceof(ServerErrorResponse);
            response.must.not.be.instanceof(AbortedResponse);
        });

        it("for client error response", async () => {
            const response = await textApi.get("/status/404", undefined, {
                throw: {
                    onServerErrorResponses: false,
                    onClientErrorResponses: false,
                },
            });
            response.must.not.be.instanceof(InformationalResponse);
            response.must.not.be.instanceof(SuccessResponse);
            response.must.not.be.instanceof(RedirectResponse);
            response.must.be.instanceof(ClientErrorResponse);
            response.must.not.be.instanceof(ServerErrorResponse);
            response.must.not.be.instanceof(AbortedResponse);
        });

        it("for server error response", async () => {
            const response = await textApi.get("/status/500", undefined, {
                throw: {
                    onServerErrorResponses: false,
                    onClientErrorResponses: false,
                },
            });
            response.must.not.be.instanceof(InformationalResponse);
            response.must.not.be.instanceof(SuccessResponse);
            response.must.not.be.instanceof(RedirectResponse);
            response.must.not.be.instanceof(ClientErrorResponse);
            response.must.be.instanceof(ServerErrorResponse);
            response.must.not.be.instanceof(AbortedResponse);
        });

        it("for aborted response", async () => {
            const req = textApi.get("/status/500");
            req.abort();
            await req.then(() => {
                throw new Error("Expected error to be thrown");
            }, (e: unknown) => {
                must(e).be.instanceof(AbortError);
                e.message.must.equal("Req abort");
                e.details.while.must.equal("connection");
                e.details.tries.must.equal(1);
            });
        });

        it("throws proper error by default on 4xx", async () => {
            const req = textApi.get("/status/404");

            await req.then(() => {
                throw new Error("Expected error to be thrown");
            }, (e: unknown) => {
                must(e).be.instanceof(HttpError);
                must(e).be.instanceof(HttpClientError);
                e.message.must.equal("NOT FOUND");

                const response = e.details.response;
                response.must.not.be.instanceof(InformationalResponse);
                response.must.not.be.instanceof(SuccessResponse);
                response.must.not.be.instanceof(RedirectResponse);
                response.must.be.instanceof(ClientErrorResponse);
                response.must.not.be.instanceof(ServerErrorResponse);
                response.must.not.be.instanceof(AbortedResponse);
            });
        });

        it("throws proper error by default on 5xx", async () => {
            const req = textApi.get("/status/500");

            await req.then(() => {
                throw new Error("Expected error to be thrown");
            }, (e: unknown) => {
                must(e).be.instanceof(HttpError);
                must(e).be.instanceof(HttpServerError);
                e.message.must.equal("INTERNAL SERVER ERROR");

                const response = e.details.response;
                response.must.not.be.instanceof(InformationalResponse);
                response.must.not.be.instanceof(SuccessResponse);
                response.must.not.be.instanceof(RedirectResponse);
                response.must.not.be.instanceof(ClientErrorResponse);
                response.must.be.instanceof(ServerErrorResponse);
                response.must.not.be.instanceof(AbortedResponse);
            });
        });
    });

    describe("handles return data types correctly", () => {
        it("throws when data type mismatch occurs", async () => {
            let caught: unknown;
            try {
                await api.get("/robots.txt");
            }
            catch (e: unknown) {
                caught = e;
            }

            if (!caught) {
                throw new Error("Expected error to be thrown");
            }

            caught.must.be.instanceof(ResponseDataTypeMismatchError);
            caught.message.must.equal("Server returned data in unexpected format");
            caught.details.response.must.be.instanceof(SuccessResponse);
            caught.details.response.headers["content-type"]!.must.equal("text/plain");
            caught.details.response.body.must.equal("User-agent: *\nDisallow: /deny\n");
            caught.details.expectedType.must.equal("json");
        });

        it("returns text when asked for text", async () => {
            const response = await api.get("/robots.txt", undefined, {
                responseType: "text",
            });
            response.body.must.be.a.string();
        });

        it("returns object when asked for json", async () => {
            const response = await api.get("/anything/basic");
            response.body.must.be.an.object();
        });
    });

    describe("sends whatever method was set", () => {
        it("supports GET", async () => {
            const response = await api.request("get", "/anything/basic");
            response.body.method.must.equal("GET");
        });

        it("supports POST", async () => {
            const postResponse = await api.request("post", "/anything/basic");
            postResponse.body.method.must.equal("POST");
        });

        it("supports PUT", async () => {
            const putResponse = await api.request("put", "/anything/basic");
            putResponse.body.method.must.equal("PUT");
        });

        it("supports PATCH", async () => {
            const patchResponse = await api.request("patch", "/anything/basic");
            patchResponse.body.method.must.equal("PATCH");
        });

        it("supports DELETE", async () => {
            const deleteResponse = await api.request("delete", "/anything/basic");
            deleteResponse.body.method.must.equal("DELETE");
        });

        it("supports HEAD", async () => {
            const headResponse = await api.request("head", "/anything/basic", undefined, {
                responseType: "text",
            });
            headResponse.body.must.equal(""); // no body, because that's HEAD req
            headResponse.status.must.equal(200);
        });

        it("supports OPTIONS", async () => {
            const optionsResponse = await api.request("options", "/anything/basic", undefined, {
                responseType: "text",
            });
            optionsResponse.body.must.equal(""); // no body, because that's OPTIONS req
            optionsResponse.status.must.equal(200);
        });

        it("supports unknown method", async () => {
            const req = api.request("WTF", "/anything/basic", undefined, {
                responseType: "text",
            });
            await req.then(() => {
                throw new Error("Expected error to be thrown");
            }, (e) => {
                must(e).be.instanceof(HttpClientError);
                e.message.must.equal("METHOD NOT ALLOWED");
            });
        });
    });

    describe("sends data with request", () => {
        it("should send a basic GET request", async () => {
            const response = await api.get("/anything/basic");

            response.status.must.equal(200);
            response.statusText.must.equal("OK");

            response.body.must.be.an.object();

            response.body.args.must.be.an.object();
            response.body.args.must.have.keys([]);

            response.body.data.must.equal("");

            response.body.files.must.be.an.object();
            response.body.files.must.have.keys([]);

            response.body.form.must.be.an.object();
            response.body.form.must.have.keys([]);

            response.body.headers.must.be.an.object();

            (response.body.json === null).must.be.true();

            response.body.method.must.equal("GET");

            response.body.url.must.equal("http://127.0.0.1:9191/anything/basic");
        });

        it("should send GET request with headers and query params", async () => {
            // body is rejected by httpbin
            // @TODO test possibility to send it anyway + maybe do a configurable throw against that

            const response = await api.get("/anything/advanced", {
                query: {
                    page: 1,
                },
                headers: {
                    custom: "header",
                },
            });
            response.body.args.must.be.an.object();
            response.body.args.must.eql({ page: "1" });

            response.body.data.must.equal("");

            response.body.files.must.be.an.object();
            response.body.files.must.have.keys([]);

            response.body.form.must.be.an.object();
            response.body.form.must.have.keys([]);

            response.body.headers.must.be.an.object();
            response.body.headers.must.have.property("Custom"); // http bin uppercases the name
            response.body.headers.Custom.must.equal("header");

            (response.body.json === null).must.be.true();

            response.body.method.must.equal("GET");

            response.body.url.must.equal("http://127.0.0.1:9191/anything/advanced?page=1");
        });

        it("should send POST request with headers, query and body", async () => {
            const response = await api.post("/anything/advanced", {
                query: {
                    page: 1,
                },
                headers: {
                    custom: "header",
                },
                body: {
                    title: "hello",
                },
            });
            response.body.args.must.be.an.object();
            response.body.args.must.eql({ page: "1" });

            response.body.data.must.equal(`{"title":"hello"}`);

            response.body.files.must.be.an.object();
            response.body.files.must.have.keys([]);

            response.body.form.must.be.an.object();
            response.body.form.must.have.keys([]);

            response.body.headers.must.be.an.object();
            response.body.headers.must.have.property("Custom"); // http bin uppercases the name
            response.body.headers.Custom.must.equal("header");

            response.body.json.must.eql({ title: "hello" });

            response.body.method.must.equal("POST");

            response.body.url.must.equal("http://127.0.0.1:9191/anything/advanced?page=1");
        });
    });

    // TODO: test upper casing method? does it matter? httpbin always upper case it
    // TODO httpbin will cry on lower case patch, but it always returns uppercased method
});
