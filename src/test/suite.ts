import { readdirSync, readFileSync, lstatSync } from "fs";
import { expect } from "chai";
import { join, extname } from "path";
import { coreLexer as lexer } from "../lex";
import { Parser, Grammar } from "nearley";
import { parseProgram } from "../parse"
import "mocha";
const testSpecRules = require("../../lib/test/spec-rules");

/*
function parse(str: string) {
    grammar.lexer = pickyLexer;
    const parser = new Parser(Grammar.fromCompiled(grammar));
    const lexer: PickyLexer = parser.lexer as PickyLexer;
    lexer.resetIdentifiers();
    const segments = str.split(";");
    segments.forEach((segment, index) => {
        parser.feed(segment);
        const parsed = parser.finish();
        if (parsed.length > 1) {
            console.log(JSON.stringify(parsed[0]));
            console.log(JSON.stringify(parsed[parsed.length - 1]));
            throw new Error(`Parse ambiguous (${parsed.length})`);
        } else if (parsed.length === 1 && index !== segments.length - 1 && parsed[0][1].length > 0) {
            const parsedGlobalDecls = parsed[0][1];
            const possibleTypedef = parsedGlobalDecls[parsedGlobalDecls.length - 1][0];
            // TODO: check that it's a typedef
            const typeIdentifier = possibleTypedef[4].name;
            lexer.addIdentifiers(typeIdentifier);
            parser.feed(" ");
        } else if (index !== segments.length - 1) {
            parser.feed(";");
        }
    });
}
*/

function testfile(filepath: string) {
    const contents = readFileSync(filepath, { encoding: "binary" });
    let specs;

    try {
        const spec = contents.match(/(\/\/test.*\n)*/);
        if (spec === null) throw new Error();
        const specParser = new Parser(Grammar.fromCompiled(testSpecRules));
        specParser.feed(spec[0]);
        specs = specParser.finish();
    } catch (e) {
        throw new Error(`Error parsing test spec for ${filepath}`);
    }
    if (specs.length === 0) throw new Error(`Could not parse test spec in ${filepath}`);
    if (specs.length > 1) throw new Error(`Test spec parsing ambiguous in ${filepath}`);

    specs[0][0].forEach((spec: any) => {
        const flags = spec[1] !== null ? spec[1][1] : null;
        let condition = spec[3][0];

        // Parse condition statement
        let condition_str;
        let retval;
        switch (condition) {
            case "return":
                retval = (spec[3][2] ? "-" : "") + spec[3][3].join("");
                condition_str = `return ${retval}`;
                break;
            case "error_parse":
                condition_str = "fail during parsing";
                break;
            case "error_typecheck":
                condition_str = "fail checking static semantics";
                break;
            case "error_static":
                condition_str = "fail purity checking";
                break;
            case "error_runtime":
                condition_str = "fail by calling error() at runtime";
                break;
            case "error":
                condition_str = "fail somehow";
                break;
            case "div-by-zero":
                condition = "aritherror";
            case "aritherror":
                condition_str = "throw an arithmetic error at runtime";
                break;
            case "segfault":
                condition = "memerror";
            case "memerror":
                condition_str = "throw an memory access error at runtime";
                break;
            case "infloop":
                condition_str = "fail to terminate";
                break;
            case "abort":
                condition_str = "fail an assertion at runtime";
                break;
            case "typecheck":
                condition_str = "successfully typecheck";
                break;
        }

        if (flags !== null) {
            xit(`test file ${filepath} with flags ${flags} should ${condition_str}`, () => {});
        } else {
            it(`test file ${filepath} should ${condition_str}`, () => {
                /* Step 1: Ensure the core lexer lexes everything */
                /* (also ignore pragma-containing files, for now) */
                let hasPragmas = false;
                lexer.reset(contents);
                for (let tok of lexer) {
                    hasPragmas = hasPragmas || tok["type"] === "pragma";
                }
                if (hasPragmas) return;

                /* Step 2: Try to parse */
                let ast;
                if (condition === "error_parse") {
                    expect(() => parseProgram(contents)).to.throw();
                    return;
                } else if (condition !== "error") {
                    expect(() => (ast = parseProgram(contents))).not.to.throw();
                } else {
                    try {
                        ast = parseProgram(contents);
                    } catch (e) {
                        return;
                    }
                }
            });
        }
    });
}

const dir = "./tests";
readdirSync(dir).forEach(subdir => {
    if (lstatSync(join(dir, subdir)).isDirectory()) {
        describe(`Tests in suite ${subdir}`, () => {
            readdirSync(join(dir, subdir)).forEach(file => {
                const ext = extname(file);
                switch (ext) {
                    case ".l1":
                    case ".l2":
                    case ".l3":
                    case ".l4":
                    case ".c0":
                    case ".c1":
                        if (!file.endsWith(`_aux${ext}`)) {
                            testfile(join(dir, subdir, file));
                        }
                }
            });
        });
    }
});
