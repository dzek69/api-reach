import { matchStatus, stripHash } from "./utils.js";
import { ResponseStatusGroup } from "./const.js";

describe("utils", () => {
    describe("matchStatus", () => {
        it("matches success statuses", async () => {
            matchStatus(200).must.equal(ResponseStatusGroup.Success);
        });

        it("matches aborted statuses", async () => {
            matchStatus(0).must.equal(ResponseStatusGroup.Aborted);
            matchStatus(499).must.equal(ResponseStatusGroup.Aborted);
        });

        it("throws on statuses > 599", async () => {
            (() => matchStatus(600)).must.throw();
            (() => matchStatus(601)).must.throw();
        });

        it("throws on status < 100 (except 0)", async () => {
            (() => matchStatus(99)).must.throw();
            (() => matchStatus(0)).must.not.throw();
            (() => matchStatus(-1)).must.throw();
        });
    });

    describe("stripHash", () => {
        it("strips hash", async () => {
            stripHash("foo#bar").must.equal("foo");
        });

        it("strips after first hash if multiple given", async () => {
            stripHash("foo#bar#baz").must.equal("foo");
        });

        it("does nothing if no hash", async () => {
            stripHash("foo").must.equal("foo");
        });
    });
});
