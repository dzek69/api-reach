import fastify from "fastify";
import { noop, wait } from "@ezez/utils";
import must from "must";
import Keyv from "keyv";

import type { CacheInterface } from "./types/cache";
import type { RequestOptions } from "./types";

import { AbortError, CacheMissError, HttpClientError, HttpError, HttpServerError, TimeoutError } from "./errors.js";
import { ExpectedResponseBodyType } from "./const.js";

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
            response: {
                status: "ok";
                base: string;
                path: string;
            };
        };
        "/anything/advanced": {
            response: any;
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
        "/users/:id/delete/x-:id": {
            response: Record<string, string>;
            params: {
                id: number;
            };
        };
    };
    "post": {
        "/anything/advanced": {
            response: any;
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
        must(body.status).equal("ok");
    });

    describe("creates proper instance", () => {
        it("for success response", async () => {
            registerMock(() => async (req, res) => res.send({}));
            const response = await localApi.get("/");
            must(response).not.be.instanceof(InformationalResponse);
            must(response).be.instanceof(SuccessResponse);
            must(response).not.be.instanceof(RedirectResponse);
            must(response).not.be.instanceof(ClientErrorResponse);
            must(response).not.be.instanceof(ServerErrorResponse);
            must(response).not.be.instanceof(AbortedResponse);
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
            must(response).be.instanceof(InformationalResponse);
            must(response).not.be.instanceof(SuccessResponse);
            must(response).not.be.instanceof(RedirectResponse);
            must(response).not.be.instanceof(ClientErrorResponse);
            must(response).not.be.instanceof(ServerErrorResponse);
            must(response).not.be.instanceof(AbortedResponse);
        });

        it("for redirect response", async () => {
            registerMock(() => async (req, res) => res.code(303).send({}));
            const response = await localApi.get("/", undefined, {
                fetchOptions: {
                    redirect: "manual",
                },
                responseType: "text",
            });
            must(response).not.be.instanceof(InformationalResponse);
            must(response).not.be.instanceof(SuccessResponse);
            must(response).be.instanceof(RedirectResponse);
            must(response).not.be.instanceof(ClientErrorResponse);
            must(response).not.be.instanceof(ServerErrorResponse);
            must(response).not.be.instanceof(AbortedResponse);
        });

        it("for client error response", async () => {
            registerMock(() => async (req, res) => res.code(404).send({}));
            const response = await localApi.get("/", undefined, {
                throw: {
                    onServerErrorResponses: false,
                    onClientErrorResponses: false,
                },
            });
            must(response).not.be.instanceof(InformationalResponse);
            must(response).not.be.instanceof(SuccessResponse);
            must(response).not.be.instanceof(RedirectResponse);
            must(response).be.instanceof(ClientErrorResponse);
            must(response).not.be.instanceof(ServerErrorResponse);
            must(response).not.be.instanceof(AbortedResponse);
        });

        it("for server error response", async () => {
            registerMock(() => async (req, res) => res.code(500).send({ expected: 500 }));
            const response = await localApi.get("/", undefined, {
                throw: {
                    onServerErrorResponses: false,
                    onClientErrorResponses: false,
                },
            });
            must(response).not.be.instanceof(InformationalResponse);
            must(response).not.be.instanceof(SuccessResponse);
            must(response).not.be.instanceof(RedirectResponse);
            must(response).not.be.instanceof(ClientErrorResponse);
            must(response).be.instanceof(ServerErrorResponse);
            must(response).not.be.instanceof(AbortedResponse);

            must(response.body.expected).equal(500); // just to make sure this wasn't random crash
        });

        it("for aborted response", async () => {
            registerMock(() => async (req, res) => res.code(404).send({}));

            const request = localApi.get("/");
            request.abort();
            await request.then(() => {
                throw new Error("Expected error to be thrown");
            }, (e: unknown) => {
                must(e).be.instanceof(AbortError);
                must(e.message).equal("Request to http://127.0.0.1:9192/ aborted");
                must(e.details.while).equal("connection");
                must(e.details.tries).equal(1);
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
            const response = await localApi.get("/anything/basic", {}, {
                responseType: ExpectedResponseBodyType.text,
            });
            response.body.must.be.a.string();
        });

        it("returns object when asked for json", async () => {
            registerMock(() => async (req, res) => res.code(200).send({ hello: "world" }));
            const response = await localApi.get("/anything/basic");
            response.body.must.be.an.object();
        });

        it("returns stream when asked for stream", async () => {
            registerMock(() => async (req, res) => res.code(200).send({ hello: "world" }));
            const response = await localApi.get("/anything/basic", undefined, {
                responseType: ExpectedResponseBodyType.stream,
            });
            must(response.body).be.an.instanceof(ReadableStream);
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
                    custom: "header",
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
                    custom: "header",
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

        it("should merge query params", async () => {
            registerMock(() => (req, res) => res.send({
                method: req.method,
                url: req.url,
                headers: req.headers,
                args: req.query,
                data: req.body,
            }));

            const response = await localApi.get("/anything/advanced?x=1&y=2", {
                query: {
                    z: 3,
                    x: 4,
                },
            });

            response.body.args.must.be.an.object();
            response.body.args.must.eql({ x: ["1", "4"], y: "2", z: "3" });
        });

        it("should apply url (:id) params", async () => {
            registerMock(() => (req, res) => res.send({
                url: req.url,
            }));

            const response = await localApi.get("/users/:id/delete/x-:id", {
                params: {
                    ":id": 1,
                },
            });

            response.body.url.must.equal("/users/1/delete/x-1");
        });

        // TODO// @TODO test possibility to send body with get anyway + maybe do a configurable throw against that
    });

    describe("supports retries", () => {
        it("basic", async () => {
            registerMock(() => (req, res) => {
                res.status(500).send({ error: "Internal Server Error" });
            });
            registerMock(() => (req, res) => {
                res.status(200).send({ success: true });
            });

            const request = await localApi.get("/anything/basic", undefined, {
                retry: 1,
            });
            request.body.success.must.equal(true);

            mockHandlers.length.must.equal(0);
        });

        it("basic that does not end with success", async () => {
            registerMock(() => (req, res) => {
                res.status(404).send({ error: "Not found" });
            });
            registerMock(() => (req, res) => {
                res.status(404).send({ error: "Not found" });
            });

            const request = await localApi.get("/anything/basic", undefined, {
                retry: 1,
                throw: {
                    onClientErrorResponses: false,
                },
            });

            request.body.error.must.equal("Not found");

            mockHandlers.length.must.equal(0);
        });
    });

    describe("supports timeouts", () => {
        it("should support single try timeout", async () => {
            registerMock(() => (req, res) => setTimeout(() => res.send({}), 400));

            const req = localApi.get("/anything/basic", undefined, {
                timeout: 300,
            });
            await req.then(() => {
                throw new Error("Expected error to be thrown");
            }, (e) => {
                must(e).be.instanceof(TimeoutError);
                e.message.must.equal("Request to http://127.0.0.1:9192/anything/basic timed out");
            });
        });

        it("should support multiple tries timeout", async () => {
            registerMock(() => (req, res) => setTimeout(() => res.send({}), 400));
            registerMock(() => (req, res) => setTimeout(() => res.send({}), 400));
            registerMock(() => (req, res) => setTimeout(() => res.send({ ok: true }), 100));

            const response = await localApi.get("/anything/basic", undefined, {
                timeout: 300,
                retry: 2,
            });
            must(response.body.ok).equal(true);
        });

        it("should support global timeout", async () => {
            registerMock(() => (req, res) => setTimeout(() => res.send({}), 400));
            registerMock(() => (req, res) => setTimeout(() => res.send({}), 400));
            registerMock(() => (req, res) => setTimeout(() => res.send({ ok: true }), 100));

            const request = localApi.get("/anything/basic", undefined, {
                timeout: {
                    single: 300,
                    total: 666, // not enough for 3 tries
                },
                retry: 2,
            });

            await request.then(() => {
                throw new Error("Expected error to be thrown");
            }, (e) => {
                must(e).be.instanceof(TimeoutError);
            });
        });
    });

    describe("supports caching", () => {
        it("basic cache", async () => {
            registerMock(() => (req, res) => res.send({ ok: true }));

            const cache = new Keyv() as CacheInterface;
            const response = await localApi.get("/anything/basic", undefined, {
                cache: {
                    storage: cache,
                    key: "x",
                    shouldCacheResponse: true,
                    ttl: undefined,
                },
            });

            response.body.ok.must.equal(true);
            response.cached.must.equal(false);

            const response2 = await localApi.get("/anything/basic", undefined, {
                cache: {
                    storage: cache,
                    key: "x",
                    shouldCacheResponse: true,
                    ttl: undefined,
                },
            });

            response2.body.ok.must.equal(true);
            response2.cached.must.equal(true);
        });

        it("throws proper error if error was cached", async () => {
            registerMock(() => (req, res) => res.status(404).send({ error: "NF" }));

            const cache = new Keyv() as CacheInterface;
            await localApi.get("/anything/basic", undefined, {
                cache: {
                    storage: cache,
                    key: "x",
                    shouldCacheResponse: true,
                    ttl: undefined,
                },
            }).then(() => {
                throw new Error("Expected error to be thrown");
            }, noop);

            const request2 = localApi.get("/anything/basic", undefined, {
                cache: {
                    storage: cache,
                    key: "x",
                    shouldCacheResponse: true,
                    ttl: undefined,
                },
            });

            await request2.then(() => {
                throw new Error("Expected error to be thrown");
            }, (e) => {
                must(e).be.instanceof(HttpClientError);
                const err = e as unknown as HttpClientError;
                err.details?.response.body.must.eql({ error: "NF" });
            });
        });

        it("throws the error when error is cached and "
            + "first request asked to resolve with error, but 2nd asked to throw", async () => {
            registerMock(() => (req, res) => res.status(404).send({ error: "NF" }));

            const cache = new Keyv() as CacheInterface;
            await localApi.get("/anything/basic", undefined, {
                cache: {
                    storage: cache,
                    key: "x",
                    shouldCacheResponse: true,
                    ttl: undefined,
                },
                throw: {
                    onClientErrorResponses: false,
                },
            });

            const request2 = localApi.get("/anything/basic", undefined, {
                cache: {
                    storage: cache,
                    key: "x",
                    shouldCacheResponse: true,
                    ttl: undefined,
                },
                throw: {
                    onClientErrorResponses: true,
                },
            });

            await request2.then(() => {
                throw new Error("Expected error to be thrown");
            }, (e) => {
                must(e).be.instanceof(HttpClientError);
            });
        });

        describe("with dynamic cache key", () => {
            it("should differentiate responses correctly", async () => {
                const cache = new Keyv() as CacheInterface;

                registerMock((req) => {
                    if (req.method === "GET" && req.url === "/anything/advanced") {
                        return (_, res) => {
                            res.send({ route: "advanced" });
                        };
                    }
                    return null;
                });

                registerMock((req) => {
                    if (req.method === "GET" && req.url === "/anything/basic") {
                        return (_, res) => {
                            res.send({ route: "basic" });
                        };
                    }
                    return null;
                });

                const cachedApi = createApiClient<ResponsesList>({
                    base: "http://127.0.0.1:9192",
                    cache: {
                        storage: cache,
                        key: (req) => req.url,
                        shouldCacheResponse: true,
                        ttl: undefined,
                    },
                });

                const res1 = await cachedApi.get("/anything/advanced");
                res1.body.route.must.equal("advanced");
                res1.cached.must.equal(false);
                const res2 = await cachedApi.get("/anything/basic");
                res2.body.route.must.equal("basic");
                res2.cached.must.equal(false);
                const res3 = await cachedApi.get("/anything/advanced");
                res3.body.route.must.equal("advanced");
                res3.cached.must.equal(true);
                const res4 = await cachedApi.get("/anything/basic");
                res4.body.route.must.equal("basic");
                res4.cached.must.equal(true);
            });

            it("should call key function with request data", async () => {
                const cache = new Keyv() as CacheInterface;

                registerMock((req) => (_, res) => { res.send({ route: req.url }); });

                const keyFn = jest.fn().mockImplementation((req) => req.url);

                const cachedApi = createApiClient<ResponsesList>({
                    base: "http://127.0.0.1:9192",
                    cache: {
                        storage: cache,
                        key: keyFn,
                        shouldCacheResponse: true,
                        ttl: undefined,
                    },
                });

                await cachedApi.post("/whatever", {
                    query: { a: 1 },
                    body: { b: 2 },
                    headers: { c: 3 },
                    params: { d: 4 },
                    bodyType: "json",
                });

                must(keyFn.mock.calls).have.length(1);
                must(keyFn.mock.calls[0]).eql([
                    {
                        query: { a: 1 },
                        body: { b: 2 },
                        headers: { c: 3 },
                        params: { d: 4 },
                        bodyType: "json",
                        method: "POST",
                        fullUrl: "http://127.0.0.1:9192/whatever?a=1",
                        url: "/whatever",
                        options: {
                            base: "http://127.0.0.1:9192",
                            responseType: "json",
                            fetchOptions: {
                                body: "{\"b\":2}",
                                headers: {
                                    "Content-Type": "application/json; charset=utf-8",
                                    "c": 3,
                                },
                                method: "POST",
                            },
                        },
                    },
                ]);
            });
        });

        describe("with dynamic shouldCacheResponse", () => {
            it("caches only requests that are allowed to cache", async () => {
                registerMock(() => (req, res) => res.send({ first: true }));
                registerMock(() => (req, res) => res.send({ second: true }));
                const cache = new Keyv() as CacheInterface;

                const options: RequestOptions<any, any> = {
                    cache: {
                        storage: cache,
                        key: "x",
                        shouldCacheResponse: (response) => {
                            const body = response.body;
                            if (typeof body !== "string" && body.second) {
                                return true;
                            }
                            return false;
                        },
                        ttl: undefined,
                    },
                };

                const r1 = await localApi.get("/anything/basic", undefined, options);
                const r2 = await localApi.get("/anything/basic", undefined, options);
                const r3 = await localApi.get("/anything/basic", undefined, options);

                r1.body.must.eql({ first: true });
                r1.cached.must.equal(false);
                r2.body.must.eql({ second: true });
                r2.cached.must.equal(false);
                r3.body.must.eql({ second: true });
                r3.cached.must.equal(true);
            });

            it("calls shouldCacheResponse with response", async () => {
                registerMock(() => (req, res) => res.send({ first: true }));

                const shouldFn = jest.fn().mockImplementation(() => true);

                const cache = new Keyv() as CacheInterface;
                const options: RequestOptions<any, any> = {
                    cache: {
                        storage: cache,
                        key: "x",
                        shouldCacheResponse: shouldFn,
                        ttl: undefined,
                    },
                };

                const response = await localApi.get("/anything/basic", undefined, options);

                must(shouldFn.mock.calls).have.length(1);
                must(shouldFn.mock.calls[0]).have.length(1);
                must(shouldFn.mock.calls[0][0]).eql(response);
            });
        });

        it("supports ttl", async () => {
            registerMock(() => (req, res) => res.send({ ok: true }));

            const cache = new Keyv() as CacheInterface;
            const response = await localApi.get("/anything/basic", undefined, {
                cache: {
                    storage: cache,
                    key: "x",
                    shouldCacheResponse: true,
                    ttl: 1000,
                },
            });

            response.body.ok.must.equal(true);
            response.cached.must.equal(false);

            const response2 = await localApi.get("/anything/basic", undefined, {
                cache: {
                    storage: cache,
                    key: "x",
                    shouldCacheResponse: true,
                    ttl: undefined,
                },
            });

            response2.body.ok.must.equal(true);
            response2.cached.must.equal(true);

            await wait(2000);

            registerMock(() => (req, res) => res.send({ ok2: true }));

            const response3 = await localApi.get("/anything/basic", undefined, {
                cache: {
                    storage: cache,
                    key: "x",
                    shouldCacheResponse: true,
                    ttl: undefined,
                },
            });

            response3.cached.must.equal(false);
            response3.body.ok2.must.equal(true);
        });

        it("supports prefer-request strategy", async () => {
            registerMock(() => (req, res) => res.send({ ok1: true }));
            registerMock(() => (req, res) => res.send({ ok2: true }));
            let called3 = false;
            registerMock(() => (req, res) => {
                called3 = true;
                return res.code(404).send({ err3: true });
            });

            const cache = new Keyv() as CacheInterface;
            const cacheOpts = {
                storage: cache,
                key: "x",
                shouldCacheResponse: true,
                ttl: undefined,
                loadStrategy: "prefer-request" as const,
            };

            const response = await localApi.get("/anything/basic", undefined, {
                cache: cacheOpts,
            });
            response.body.ok1.must.equal(true);
            response.cached.must.be.false();

            const response2 = await localApi.get("/anything/basic", undefined, {
                cache: cacheOpts,
            });
            response2.body.ok2.must.equal(true);
            response2.cached.must.be.false();

            called3.must.be.false();
            const response3 = await localApi.get("/anything/basic", undefined, {
                cache: cacheOpts,
            });
            called3.must.be.true(); // it tried
            response3.body.ok2.must.equal(true);
            response3.cached.must.be.true(); // but finally used cache

            const response4 = await localApi.get("/anything/basic", undefined, {
                cache: {
                    ...cacheOpts,
                    loadStrategy: "prefer-cache",
                },
            });
            response4.cached.must.equal(true);
        });

        it("supports cache-only strategy", async () => {
            registerMock(() => (req, res) => res.send({ ok1: true }));

            const cache = new Keyv() as CacheInterface;
            const cacheOpts = {
                storage: cache,
                key: "x",
                shouldCacheResponse: true,
                ttl: undefined,
                loadStrategy: "cache-only" as const,
            };

            const request = localApi.get("/anything/basic", undefined, {
                cache: cacheOpts,
            });

            request.then(() => {
                throw new Error("Expected request to fail");
            }, (e: unknown) => {
                // TODO cache miss should include request details?
                e.must.be.instanceof(CacheMissError);
            });

            await localApi.get("/anything/basic", undefined, {
                cache: {
                    ...cacheOpts,
                    loadStrategy: "prefer-cache",
                },
            });

            const response3 = await localApi.get("/anything/basic", undefined, {
                cache: cacheOpts,
            });

            response3.body.ok1.must.equal(true);
            must(response3.cached).be.true();
        });

        it("supports request-only strategy", async () => {
            registerMock(() => (req, res) => res.send({ ok1: true }));
            registerMock(() => (req, res) => res.send({ ok2: true }));
            registerMock(() => (req, res) => res.code(404).send({ err3: true }));

            let cacheGetCalledTimes = 0;

            const cache = new Keyv() as CacheInterface;
            const originalGet = cache.get;
            cache.get = function(...args) {
                cacheGetCalledTimes++;
                return originalGet.apply(this, args);
            };

            const cacheOpts = {
                storage: cache,
                key: "x",
                shouldCacheResponse: true,
                ttl: undefined,
                loadStrategy: "request-only" as const,
            };

            const response = await localApi.get("/anything/basic", undefined, {
                cache: cacheOpts,
            });
            response.body.ok1.must.equal(true);
            response.cached.must.be.false();
            cacheGetCalledTimes.must.equal(0);

            const response2 = await localApi.get("/anything/basic", undefined, {
                cache: cacheOpts,
            });
            response2.body.ok2.must.equal(true);
            response2.cached.must.be.false();
            cacheGetCalledTimes.must.equal(0);

            const response3 = await localApi.get("/anything/basic", undefined, {
                cache: cacheOpts,
                throw: {
                    onClientErrorResponses: false,
                },
            });
            response3.body.err3.must.equal(true);
            response3.cached.must.be.false();
            cacheGetCalledTimes.must.equal(0);
        });

        it("supports no-save strategy", async () => {
            registerMock(() => (req, res) => res.send({ ok1: true }));
            registerMock(() => (req, res) => res.send({ ok2: true }));
            registerMock(() => (req, res) => res.send({ ok3: true }));

            let cacheSetCalledTimes = 0;

            const cache = new Keyv() as CacheInterface;
            const originalSet = cache.set;
            cache.set = function(...args) {
                cacheSetCalledTimes++;
                return originalSet.apply(this, args);
            };

            const cacheOpts = {
                storage: cache,
                key: "x",
                shouldCacheResponse: true,
                ttl: undefined,
                loadStrategy: "request-only" as const,
                saveStrategy: "no-save" as const,
            };

            const response = await localApi.get("/anything/basic", undefined, {
                cache: cacheOpts,
            });
            response.body.ok1.must.equal(true);
            response.cached.must.be.false();
            cacheSetCalledTimes.must.equal(0);

            const response2 = await localApi.get("/anything/basic", undefined, {
                cache: {
                    ...cacheOpts,
                    loadStrategy: "prefer-cache",
                },
            });

            response2.body.ok2.must.equal(true);
            response2.cached.must.be.false();
            cacheSetCalledTimes.must.equal(0);

            const response3 = await localApi.get("/anything/basic", undefined, {
                cache: {
                    ...cacheOpts,
                    loadStrategy: "prefer-request",
                },
            });

            response3.body.ok3.must.equal(true);
            response3.cached.must.be.false();
            cacheSetCalledTimes.must.equal(0);

            const request4 = localApi.get("/anything/basic", undefined, {
                cache: {
                    ...cacheOpts,
                    loadStrategy: "prefer-cache",
                },
            });

            request4.then(() => {
                throw new Error("Expected request to fail");
            }, (e: unknown) => {
                must(e).be.instanceof(CacheMissError);
                cacheSetCalledTimes.must.equal(0);
            });
        });
    });

    // TODO: test upper casing method? does it matter? httpbin always upper case it
    // TODO httpbin will cry on lower case patch, but it always returns uppercased method

    // TODO test for mixing relative and absolute urls
    // TODO custom dependencies

    // TODO cache function ttl as function, key as fn, etc

    // TODO strip hash from relative url
    // TODO throw if hash given for base url
});
