import { readdirSync, readFileSync, lstatSync } from "fs";
import { expect } from "chai";
import { join, extname } from "path";
import { coreLexer as lexer } from "../lex";
import { parseProgram } from "../parse";
import Lang, { parse as parseLang } from "../lang";
import { parseSpec } from "./parsespec";
import "mocha";

function testfile(filenameLang: Lang, filepath: string) {
    const contents = readFileSync(filepath, { encoding: "binary" });
    const spectxt = contents.match(/(\/\/test.*(\r|\n|\n\r|\r\n))+/);
    if (spectxt === null) throw new Error(`No specs in file ${filepath}`);
    const specs = parseSpec(filenameLang, spectxt[0]);
    specs.forEach((spec, i) => {
        it(`test ${filepath}.${i}, should ${spec.description}`, () => {
            /* Step 1: Ensure the core lexer lexes everything */
            /* (also ignore pragma-contining files, for now) */
            let hasPragmas = false;
            lexer.reset(contents);
            for (let tok of lexer) {
                hasPragmas = hasPragmas || tok["type"] === "pragma";
            }
            if (hasPragmas) return;

            /* Step 2: Try to parse */
            let ast;
            if (spec.outcome === "error_parse") {
                expect(() => parseProgram(spec.lang, contents)).to.throw();
            } else if (spec.outcome !== "error") {
                expect(() => (ast = parseProgram(spec.lang, contents))).not.to.throw();
            } else {
                try {
                    ast = parseProgram(spec.lang, contents);
                } catch (e) {
                    return;
                }
            }
        });
    });
}

const dir = "./tests";
//readdirSync(dir)
["coverage"].forEach(subdir => {
    if (lstatSync(join(dir, subdir)).isDirectory()) {
        describe(`Tests in suite ${subdir}`, () => {
            readdirSync(join(dir, subdir)).forEach(file => {
                const ext = extname(file);
                let lang = parseLang(ext);
                if (lang !== null && !file.endsWith(`_aux${ext}`)) {
                    testfile(lang, join(dir, subdir, file));
                }
            });
        });
    }
});
