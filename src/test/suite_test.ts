import { readdirSync, readFileSync, lstatSync } from "fs";
import { expect } from "chai";
import { join, extname, basename } from "path";
import { createAnnoLexer } from "../lex";
import { parseProgram } from "../parse/index";
import Lang, { parse as parseLang } from "../lang";
import { parseSpec, Spec } from "./parsespec";
import { checkProgram } from "../typecheck/programs";
import * as ast from "../ast";
import "mocha";
import { program as generateProgram } from "../bytecode/generate";

function extractTypedefs(decls: ast.Declaration[]): Set<string> {
    return decls.reduce((set, decl) => {
        switch (decl.tag) {
            case "TypeDefinition":
            case "FunctionTypeDefinition":
                return set.add(decl.definition.id.name);
            default:
                return set;
        }
    }, new Set<string>());
}

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
            let libAst: ast.Declaration[] = [];
            let ast: ast.Declaration[] = [];
            if (spec.outcome === "error_parse") {
                expect(() => {
                    libAst = libcontents.reduce(
                        (ast, libstr) => ast.concat(parseProgram("C1", libstr)),
                        libAst
                    );
                    const typedefs = extractTypedefs(libAst);
                    ast = parseProgram(spec.lang, contents, typedefs);
                }).to.throw();
                return;
            } else if (spec.outcome !== "error") {
                expect(
                    () =>
                        (libAst = libcontents.reduce(
                            (ast, libstr) => ast.concat(parseProgram("C1", libstr)),
                            libAst
                        ))
                ).not.to.throw();
                const typedefs = extractTypedefs(libAst);
                expect(() => (ast = parseProgram(spec.lang, contents, typedefs))).not.to.throw();
            } else {
                try {
                    libAst = libcontents.reduce(
                        (ast, libstr) => ast.concat(parseProgram("C1", libstr)),
                        libAst
                    );
                    const typedefs = extractTypedefs(libAst);
                    ast = parseProgram(spec.lang, contents, typedefs);
                } catch (e) {
                    return;
                }
            }

            /* Step 3: Try to typecheck */
            /* The first branch is wrong: error does allow error_statics */
            if (spec.outcome === "error_typecheck" || spec.outcome === "error") {
                expect(() => checkProgram(libAst, ast)).to.throw();
                return;
            } else if (spec.outcome !== "error") {
                expect(() => checkProgram(libAst, ast)).not.to.throw();
            } else {
                try {
                    checkProgram(libAst, ast);
                } catch (e) {
                    return;
                }
            }

            expect(() => generateProgram(ast, spec.debug)).not.to.throw();
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

                    if (lang == "L1" || lang == "L2") {
                        libs = [];
                    } else if (lang === "L3" || lang === "L4") {
                        // For compatibility with the
                        const lib = join(dir, subdir, base + ".h0");
                        try {
                            lstatSync(lib);
                            libs = [lib];
                        } catch (e) {
                            libs = [join(".", "stdlib", "15411.h0")];
                        }
                    } else {
                        libs = [];
                    }
                    testfile(lang, libs, join(dir, subdir, file));
                }
            });
        });
    }
});
