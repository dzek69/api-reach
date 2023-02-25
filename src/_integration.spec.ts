import type { HTTPBinAnythingResponse } from "../test/httpbinResponse";

import { createApiClient } from "./index.js";

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

    it("should send a basic GET request", async () => {
        const response = await api.get("/anything/basic");
        response.status.must.equal(200);
        response.statusText.must.equal("OK");
        // response.headers.must.be.an.object();
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

        response.body.data.must.equal("");

        response.body.files.must.be.an.object();
        response.body.files.must.have.keys([]);

        response.body.form.must.be.an.object();
        response.body.form.must.have.keys([]);

        response.body.headers.must.be.an.object();
        response.body.headers.must.have.property("Custom"); // http bin uppercases the name
        response.body.headers.Custom.must.equal("header");

        (response.body.json === null).must.be.true();

        response.body.method.must.equal("POST");

        response.body.url.must.equal("http://127.0.0.1:9191/anything/advanced?page=1");
    });

    // TODO: test upper casing method? does it matter? httpbin always upper case it
});
