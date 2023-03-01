import fastify from "fastify";
import { wait } from "@ezez/utils";

import type { HTTPBinAnythingResponse } from "../test/httpbinResponse";

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
    const server = fastify();
    server.route({
        method: [
            "DELETE", "GET", "HEAD", "PATCH", "POST", "PUT", "OPTIONS", "SEARCH", "TRACE", "PROPFIND", "PROPPATCH",
            "MKCOL", "COPY", "MOVE", "LOCK", "UNLOCK",
        ],
        url: "*",
        handler: (req, res) => {
            if (!mockHandlers.length) {
                console.error("No more calls expected!");
                throw new Error("No more calls expected!");
            }

            const mockIndex = mockHandlers.findIndex((m) => m(req, res));
            if (mockIndex === -1) {
                console.error("No matching mock found!");
                throw new Error("No matching mock found!");
            }

            const mock = mockHandlers[mockIndex](req, res);
            mockHandlers.splice(mockIndex, 1);

            mock(req, res);
        },
    });

    type Req = Parameters<Parameters<typeof server.route>[0]["handler"]>[0];
    type Res = Parameters<Parameters<typeof server.route>[0]["handler"]>[1];

    type Mock = (req: Req, res: Res) => ((req_: Req, res_: Res) => unknown) | undefined | null;

    const mockHandlers: Mock[] = [];

    const registerMock = (mock: Mock) => {
        mockHandlers.push(mock);
    };

    beforeAll(async () => {
        await server.listen({ port: 9192 });
    });

    afterEach(() => {
        if (mockHandlers.length) {
            console.log("clearing leftovers");
            mockHandlers.length = 0;
            throw new Error("Not every expected call was made");
        }
    });

    afterAll(async () => {
        await server.close();
    });

    const localApi = createApiClient<ResponsesList>({
        base: "http://127.0.0.1:9192",
    });

    it("TS", async () => {
        registerMock((req, res) => {
            if (req.method === "GET" && req.url === "/anything/advanced") {
                return (req, res) => {
                    res.send({ status: "ok" });
                };
            }
            return null;
        });
        const response = await localApi.get("/anything/advanced");
        const body = response.body;
        body.status.must.equal("ok");
    });

    describe("creates proper instance", () => {
        it("for success response", async () => {
            registerMock(() => async (req, res) => res.send({}));
            const response = await localApi.get("/");
            response.must.not.be.instanceof(InformationalResponse);
            response.must.be.instanceof(SuccessResponse);
            response.must.not.be.instanceof(RedirectResponse);
            response.must.not.be.instanceof(ClientErrorResponse);
            response.must.not.be.instanceof(ServerErrorResponse);
            response.must.not.be.instanceof(AbortedResponse);
        });

        it.skip("for informational response", async () => {
            // TODO this needs verifying
            registerMock(() => (req, res) => res.code(100).send({}));
            const response = await localApi.get("/", undefined,
                {
                    fetchOptions: {
                        headers: {
                            Expect: "100-continue",
                        },
                    },
                });
            response.must.be.instanceof(InformationalResponse);
            response.must.not.be.instanceof(SuccessResponse);
            response.must.not.be.instanceof(RedirectResponse);
            response.must.not.be.instanceof(ClientErrorResponse);
            response.must.not.be.instanceof(ServerErrorResponse);
            response.must.not.be.instanceof(AbortedResponse);
        });

        it("for redirect response", async () => {
            registerMock(() => async (req, res) => res.code(303).send({}));
            const response = await localApi.get("/", undefined, {
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
            registerMock(() => async (req, res) => res.code(404).send({}));
            const response = await localApi.get("/", undefined, {
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
            registerMock(() => async (req, res) => res.code(500).send({ expected: 500 }));
            const response = await localApi.get("/", undefined, {
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

            response.body.expected.must.equal(500); // just to make sure this wasn't random crash
        });

        it("for aborted response", async () => {
            registerMock(() => async (req, res) => res.code(404).send({}));

            const request = localApi.get("/");
            request.abort();
            await request.then(() => {
                throw new Error("Expected error to be thrown");
            }, (e: unknown) => {
                must(e).be.instanceof(AbortError);
                e.message.must.equal("Req abort");
                e.details.while.must.equal("connection");
                e.details.tries.must.equal(1);
            });

            await wait(100);
            // wait to let the mock run in case it was not called, because abort happened
        });

        it("throws proper error by default on 4xx", async () => {
            registerMock((req) => {
                if (req.url === "/404") {
                    return async (req, res) => res.code(404).send({});
                }
                return null;
            });
            const request = localApi.get("/404");

            await request.then(() => {
                throw new Error("Expected error to be thrown");
            }, (e: unknown) => {
                must(e).be.instanceof(HttpError);
                must(e).be.instanceof(HttpClientError);
                e.message.must.equal("Not Found");

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
            registerMock((req) => {
                if (req.url === "/status/500") {
                    return async (_, res) => res.code(500).send({});
                }
                return null;
            });

            const request = localApi.get("/status/500");

            await request.then(() => {
                throw new Error("Expected error to be thrown");
            }, (e: unknown) => {
                must(e).be.instanceof(HttpError);
                must(e).be.instanceof(HttpServerError);
                e.message.must.equal("Internal Server Error");

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
            registerMock(() => async (req, res) => res.code(200).send("User-agent: *\nDisallow: /deny\n"));

            let caught: unknown;
            try {
                await localApi.get("/robots.txt");
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
            caught.details.response.body.must.equal("User-agent: *\nDisallow: /deny\n");
            caught.details.expectedType.must.equal("json");
        });

        it("returns text when asked for text", async () => {
            registerMock(() => async (req, res) => res.code(200).send("User-agent: *\nDisallow: /deny\n"));
            const response = await localApi.get("/robots.txt", undefined, {
                responseType: "text",
            });
            response.body.must.be.a.string();
        });

        it("returns object when asked for json", async () => {
            registerMock(() => async (req, res) => res.code(200).send({ hello: "world" }));
            const response = await localApi.get("/anything/basic");
            response.body.must.be.an.object();
        });
    });

    describe("sends whatever method was set", () => {
        it("supports GET", async () => {
            registerMock(() => (req, res) => res.send({ method: req.method }));
            const response = await localApi.request("get", "/anything/basic");
            response.body.method.must.equal("GET");
        });

        it("supports POST", async () => {
            registerMock(() => (req, res) => res.send({ method: req.method }));
            const postResponse = await localApi.request("post", "/anything/basic");
            postResponse.body.method.must.equal("POST");
        });

        it("supports PUT", async () => {
            registerMock(() => (req, res) => res.send({ method: req.method }));
            const putResponse = await localApi.request("put", "/anything/basic");
            putResponse.body.method.must.equal("PUT");
        });

        it("supports PATCH", async () => {
            registerMock(() => (req, res) => res.send({ method: req.method }));
            const patchResponse = await localApi.request("patch", "/anything/basic");
            patchResponse.body.method.must.equal("PATCH");
        });

        it("supports DELETE", async () => {
            registerMock(() => (req, res) => res.send({ method: req.method }));
            const deleteResponse = await localApi.request("delete", "/anything/basic");
            deleteResponse.body.method.must.equal("DELETE");
        });

        it("supports HEAD", async () => {
            registerMock(() => (req, res) => res.send({ method: req.method }));
            const headResponse = await localApi.request("head", "/anything/basic", undefined, {
                responseType: "text",
            });
            headResponse.body.must.equal(""); // no body, because that's HEAD req
            headResponse.status.must.equal(200);
        });

        it("supports OPTIONS", async () => {
            registerMock(() => (req, res) => res.send({ method: req.method }));
            const optionsResponse = await localApi.request("options", "/anything/basic", undefined, {
                responseType: "text",
            });
            optionsResponse.body.must.equal(`{"method":"OPTIONS"}`); // fastify supports custom response!
            optionsResponse.status.must.equal(200);
        });

        it("supports unknown method", async () => {
            // registerMock(() => (req, res) => res.send({ method: req.method }));
            // No mock, fastify won't execute anything on unknown method
            const req = localApi.request("WTF", "/anything/basic", undefined, {
                responseType: "text",
            });
            await req.then(() => {
                throw new Error("Expected error to be thrown");
            }, (e) => {
                must(e).be.instanceof(HttpClientError);
                e.message.must.equal("Bad Request");
            });
        });
    });

    describe("sends data with request", () => {
        it("should send a basic GET request", async () => {
            registerMock(() => (req, res) => res.send({
                method: req.method,
                url: req.url,
                headers: req.headers,
                args: req.query,
                data: req.body,
            }));
            const response = await localApi.get("/anything/basic");

            response.status.must.equal(200);
            response.statusText.must.equal("OK");

            response.body.must.be.an.object();

            response.body.args.must.be.an.object();
            response.body.args.must.have.keys([]);

            must(response.body.data).equal(undefined);

            response.body.headers.must.be.an.object();

            response.body.method.must.equal("GET");

            response.body.url.must.equal("/anything/basic");
        });

        it("should send GET request with headers and query params", async () => {
            registerMock(() => (req, res) => res.send({
                method: req.method,
                url: req.url,
                headers: req.headers,
                args: req.query,
                data: req.body,
            }));

            // body is rejected by fetch
            const response = await localApi.get("/anything/advanced", {
                query: {
                    page: 1,
                },
                headers: {
                    Custom: "header",
                },
            });
            response.body.args.must.be.an.object();
            response.body.args.must.eql({ page: "1" });

            response.body.headers.must.be.an.object();
            response.body.headers.must.have.property("custom"); // http bin lowercases the name
            response.body.headers.custom.must.equal("header");

            response.body.method.must.equal("GET");

            response.body.url.must.equal("/anything/advanced?page=1");
        });

        it("should send POST request with headers, query and body", async () => {
            registerMock(() => (req, res) => res.send({
                method: req.method,
                url: req.url,
                headers: req.headers,
                args: req.query,
                data: req.body,
            }));

            const response = await localApi.post("/anything/advanced", {
                query: {
                    page: 1,
                },
                headers: {
                    Custom: "header",
                },
                body: {
                    title: "hello",
                },
            });
            response.body.args.must.be.an.object();
            response.body.args.must.eql({ page: "1" });

            response.body.data.must.eql({ title: "hello" });

            response.body.headers.must.be.an.object();
            response.body.headers.must.have.property("custom");
            response.body.headers.custom.must.equal("header");

            response.body.method.must.equal("POST");

            response.body.url.must.equal("/anything/advanced?page=1");
        });

        // TODO// @TODO test possibility to send body with get anyway + maybe do a configurable throw against that
    });

    describe("supports timeouts", () => {
        it("should support single try timeout", async () => {

        });
    });

    // TODO: test upper casing method? does it matter? httpbin always upper case it
    // TODO httpbin will cry on lower case patch, but it always returns uppercased method
});
