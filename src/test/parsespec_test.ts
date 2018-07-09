import { expect } from "chai";
import "mocha";
import { parseSpec } from "./parsespec";

describe("The spec parser", () => {
    it("Should accept all line formats", () => {
        expect(parseSpec("C0", "//test error\n").length).to.equal(1);
        expect(parseSpec("C0", "//test error\r").length).to.equal(1);
        expect(parseSpec("C0", "//test error\r\n").length).to.equal(1);
        expect(parseSpec("C0", "//test error\n\r").length).to.equal(1);
    });

    it("Should accept empty input", () => {
        expect(parseSpec("C0", "").length).to.equal(0);
    });

    it("Should reject without newliens", () => {
        expect(() => parseSpec("C0", "//test error")).to.throw();
        expect(() => parseSpec("C0", "//test error\n//test error")).to.throw();
        expect(() => parseSpec("C0", "//test error\n// blah")).to.throw();
    });

    it("Should reject garbage commands", () => {
        expect(() => parseSpec("C0", "//test win\n")).to.throw();
    })

    it("Should capture return conditions as numbers", () => {
        expect(parseSpec("C0", "//test return 4\n")[0].key).to.equal(4);
        expect(parseSpec("C0", "//test return 0\n")[0].key).to.equal(0);
        expect(parseSpec("C0", "//test return -123\n")[0].key).to.equal(-123);
    });

    it("Should capture non-return conditions as strings", () => {
        expect(parseSpec("C0", "//test error_parse\n")[0].key).to.equal("error_parse");
        expect(parseSpec("C0", "//test error_typecheck\n")[0].key).to.equal("error_typecheck");
        expect(parseSpec("C0", "//test error_static\n")[0].key).to.equal("error_static");
        expect(parseSpec("C0", "//test error_runtime\n")[0].key).to.equal("error_runtime");
        expect(parseSpec("C0", "//test error\n")[0].key).to.equal("error");
        expect(parseSpec("C0", "//test div-by-zero\n")[0].key).to.equal("aritherror");
        expect(parseSpec("C0", "//test aritherror\n")[0].key).to.equal("aritherror");
        expect(parseSpec("C0", "//test infloop\n")[0].key).to.equal("infloop");
        expect(parseSpec("C0", "//test abort\n")[0].key).to.equal("abort");
        expect(parseSpec("C0", "//test segfault\n")[0].key).to.equal("memerror");
        expect(parseSpec("C0", "//test memerror\n")[0].key).to.equal("memerror");
        expect(parseSpec("C0", "//test typecheck\n")[0].key).to.equal("typecheck");
    });
});
