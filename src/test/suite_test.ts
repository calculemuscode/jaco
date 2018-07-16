import { readdirSync, readFileSync, lstatSync } from "fs";
import { List } from "immutable";
import { expect } from "chai";
import { join, extname, basename } from "path";
import { createAnnoLexer } from "../lex";
import { parseProgram } from "../parse";
import Lang, { parse as parseLang } from "../lang";
import { parseSpec, Spec } from "./parsespec";
import { checkProgram } from "../typecheck/programs";
import * as ast from "../ast";
import "mocha";

function testfile(filenameLang: Lang, libs: string[], filepath: string) {
    const libcontents = libs.map(lib => readFileSync(lib, { encoding: "binary" }));
    const contents = readFileSync(filepath, { encoding: "binary" });
    const spectxt = contents.match(/(\/\/test .*(\r|\n|\n\r|\r\n))+/);
    if (spectxt === null) {
        console.warn(`No specs in file ${filepath}`);
        return;
    }
    let specs: Spec[];
    try {
        specs = parseSpec(filenameLang, spectxt[0], filepath);
    } catch (err) {
        console.log(err.message);
        specs = [];
    }
    specs.forEach((spec, i) => {
        it(`test ${filepath}.${i}, should ${spec.description}`, () => {
            /* Step 1: Ensure the core lexer lexes everything */
            /* (also ignore pragma-contining files, for now) */
            const lexer = createAnnoLexer();
            let hasPragmas = false;
            lexer.reset(contents);
            for (let tok of lexer) {
                hasPragmas = hasPragmas || tok["type"] === "pragma";
            }
            if (hasPragmas) return;
            if (spec.files.length > 0 || spec.libs.length > 0) return;
        

            /* Step 2: Try to parse */
            let libAsts: List<List<ast.Declaration>> = List();
            let ast: List<ast.Declaration> = List();
            if (spec.outcome === "error_parse") {
                expect(() => {
                    List(libcontents).forEach(libstr => parseProgram(spec.lang, libstr));
                    parseProgram(spec.lang, contents)
                }).to.throw();
                return;
            } else if (spec.outcome !== "error") {
                expect(() => (libAsts = List(libcontents).map(libstr => parseProgram(spec.lang, libstr)))).not.to.throw();
                expect(() => (ast = parseProgram(spec.lang, contents))).not.to.throw();
            } else {
                try {
                    ast = parseProgram(spec.lang, contents);
                } catch (e) {
                    return;
                }
            }

            /* Step 3: Try to typecheck */
            /* The first branch is wrong: error does allow error_statics */
            if (spec.outcome === "error_typecheck" || spec.outcome === "error") {
                expect(() => checkProgram(libAsts, ast)).to.throw();
                return;
            } else if (spec.outcome !== "error") {
                expect(() => checkProgram(libAsts, ast)).not.to.throw();
            } else {
                try {
                    checkProgram(libAsts, ast)
                } catch (e) {
                    return;
                }
            }
        });
    });
}

const dir = "./tests";
readdirSync(dir).forEach(subdir => {
    if (lstatSync(join(dir, subdir)).isDirectory()) {
        describe(`Tests in suite ${subdir}`, () => {
            readdirSync(join(dir, subdir)).forEach(file => {
                const ext = extname(file);
                const base = basename(file, ext);
                let lang = parseLang(ext);
                if (lang !== null && !file.endsWith(`_aux${ext}`)) {
                    let libs: string[];
                    const lib = join(dir, subdir, base+'.h0');
                    try {
                        lstatSync(lib);
                        console.log(`Hey ${lib}`);
                        libs = [lib];
                    } catch(e) {
                        libs = [];
                    }
                    testfile(lang, libs, join(dir, subdir, file));
                }
            });
        });
    }
});
