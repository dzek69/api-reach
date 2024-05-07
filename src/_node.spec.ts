import * as fs from "fs";

import type { ExpectedResponseBodyType } from "./const";

import { download } from "./node";

import { createApiClient } from "./index";

const TXT_FILE = "https://gist.githubusercontent.com/apipemc/6047552/raw/5cf8793e00d569de4f1ee8c125648ee5e0b6e2de/links.txt";

const api = createApiClient<any, ExpectedResponseBodyType.stream >({});

describe("download", () => {
    it("should download a file", async () => {
        // create writable stream:
        const writableStream = fs.createWriteStream("./file.txt");

        console.info("Downloading...");
        await download(writableStream, api, "get", TXT_FILE);
        console.info("Downloaded");
    });
});
