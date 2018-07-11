import { expect } from "chai";
import "mocha";
import { parseSpec } from "./parsespec";

describe("The spec parser", () => {
    it("should accept all line formats", () => {
        expect(parseSpec("C0", "//test error\n").length).to.equal(1);
        expect(parseSpec("C0", "//test error\r").length).to.equal(1);
        expect(parseSpec("C0", "//test error\r\n").length).to.equal(1);
        expect(parseSpec("C0", "//test error\n\r").length).to.equal(1);
    });

    it("should accept empty input", () => {
        expect(parseSpec("C0", "").length).to.equal(0);
    });

    it("should reject without newliens", () => {
        expect(() => parseSpec("C0", "//test error")).to.throw();
        expect(() => parseSpec("C0", "//test error\n//test error")).to.throw();
        expect(() => parseSpec("C0", "//test error\n// blah")).to.throw();
    });

    it("should reject garbage commands", () => {
        expect(() => parseSpec("C0", "//test win\n")).to.throw();
        expect(() => parseSpec("C0", "//test nonsense\n")).to.throw();
    });

    it("should capture return conditions as numbers", () => {
        expect(parseSpec("C0", "//test return 4\n")[0].outcome).to.equal(4);
        expect(parseSpec("C0", "//test return 0\n")[0].outcome).to.equal(0);
        expect(parseSpec("C0", "//test return -123\n")[0].outcome).to.equal(-123);
    });

    it("should capture non-return conditions as strings", () => {
        expect(parseSpec("C0", "//test error_parse\n")[0].outcome).to.equal("error_parse");
        expect(parseSpec("C0", "//test error_typecheck\n")[0].outcome).to.equal("error_typecheck");
        expect(parseSpec("C0", "//test error_static\n")[0].outcome).to.equal("error_static");
        expect(parseSpec("C0", "//test error_runtime\n")[0].outcome).to.equal("error_runtime");
        expect(parseSpec("C0", "//test error\n")[0].outcome).to.equal("error");
        expect(parseSpec("C0", "//test div-by-zero\n")[0].outcome).to.equal("aritherror");
        expect(parseSpec("C0", "//test aritherror\n")[0].outcome).to.equal("aritherror");
        expect(parseSpec("C0", "//test infloop\n")[0].outcome).to.equal("infloop");
        expect(parseSpec("C0", "//test abort\n")[0].outcome).to.equal("abort");
        expect(parseSpec("C0", "//test segfault\n")[0].outcome).to.equal("memerror");
        expect(parseSpec("C0", "//test memerror\n")[0].outcome).to.equal("memerror");
        expect(parseSpec("C0", "//test typecheck\n")[0].outcome).to.equal("typecheck");
    });

    it("has correct defaults without flags", () => {
        expect(parseSpec("C0", "//test return 4\n")[0].lang).to.equal("C0");
        expect(parseSpec("L2", "//test return 4\n")[0].lang).to.equal("L2");
        expect(parseSpec("C0", "//test return 4\n")[0].debug).to.equal(false);
        expect(parseSpec("C0", "//test return 4\n")[0].purity).to.equal(true);
        expect(parseSpec("C0", "//test return 4\n")[0].libs).to.deep.equal([]);
    });

    it("has correct results with flags", () => {
        expect(parseSpec("C0", "//test --standard=L1 => return 4\n")[0].outcome).to.equal(4);
        expect(parseSpec("C0", "//test --standard=L1 => error\n")[0].outcome).to.equal("error");
        expect(parseSpec("C0", "//test --standard=L1 => return 4\n")[0].lang).to.equal("L1");
        expect(parseSpec("C0", "//test --standard=l2 => return 4\n")[0].lang).to.equal("L2");
        expect(parseSpec("C0", "//test --standard=L3 => return 4\n")[0].lang).to.equal("L3");
        expect(parseSpec("C0", "//test --standard=l4 => return 4\n")[0].lang).to.equal("L4");
        expect(parseSpec("C0", "//test --standard=C0 => return 4\n")[0].lang).to.equal("C0");
        expect(parseSpec("C0", "//test --standard=c1 => return 4\n")[0].lang).to.equal("C1");
        expect(parseSpec("C0", "//test -d => return 4\n")[0].debug).to.equal(true);
        expect(parseSpec("C0", "//test --no-purity-check => return 4\n")[0].purity).to.equal(false);
        expect(parseSpec("C0", "//test -lfoo => return 4\n")[0].libs).to.deep.equal(["foo"]);
        expect(parseSpec("C0", "//test -lfoo -d -lbar => return 4\n")[0].libs).to.deep.equal(["foo", "bar"]);
        expect(parseSpec("C0", "//test -lfoo -d -lbar => return 4\n")[0].debug).to.equal(true);
    });

    it("should reject redundant or conflicting flags", () => {
        expect(() => parseSpec("C0", "//test -lfoo -lfoo => error\n")).to.throw();
        expect(() => parseSpec("C0", "//test -lfoo -d -lfoo => error\n")).to.throw();
        expect(() => parseSpec("C0", "//test -d -d => error\n")).to.throw();
        expect(() => parseSpec("C0", "//test --no-purity-check --no-purity-check => error\n")).to.throw();
        expect(() => parseSpec("C0", "//test --standard=c0 --standard=c0 => error\n")).to.throw();
        expect(() => parseSpec("C0", "//test --standard=c0 --standard=c1 => error\n")).to.throw();
    });
});
