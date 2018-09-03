/**
 * Parse spec according to the grammar in tests/README.md
 */

import Lang, { parse as parseLang } from "../lang";
import { Parser, Grammar } from "nearley";
const testSpecRules = require("../../lib/spec-rules");

export type Outcome =
    | number
    | "error_parse"
    | "error_typecheck"
    | "error_static"
    | "error"
    | "failure"
    | "aritherror"
    | "memerror"
    | "infloop"
    | "abort"
    | "typecheck"
    | "compile";
export interface Spec {
    outcome: Outcome;
    description: string;
    debug: boolean;
    purity: boolean;
    libs: string[];
    files: string[];
    lang: Lang;
}

export function parseSpec(defaultLang: Lang, spec: string, filename?: string): Spec[] {
    let specs;
    try {
        const specParser = new Parser(Grammar.fromCompiled(testSpecRules));
        specParser.feed(spec);
        specs = specParser.finish();
    } catch (err) {
        throw new Error(`Error parsing test spec${filename ? ` for ${filename}` : ""}:\n${err}`);
    }

    if (specs.length === 0) throw new Error(`No test spec found`);
    /* istanbul ignore next */
    if (specs.length > 1) {
        throw new Error(`Test spec parsing ambiguous (should be impossible, please report)`);
    }

    return specs[0][0].map((spec: any) => {
        const outcome = ((cond: string): [Outcome, string] => {
            switch (cond) {
                case "return": {
                    const retVal = (spec[3][2] ? "-" : "") + spec[3][3].join("");
                    return [parseInt(retVal)|0, `return ${retVal}`];
                }
                case "error_parse":
                    return [cond, "fail during parsing"];
                case "error_typecheck":
                    return [cond, "fail checking static semantics"];
                case "error_static":
                    return [cond, "fail checking purity"];
                case "error":
                    return [cond, "fail somehow"];
                case "failure":
                    return [cond, "call error() at runtime"];
                case "div-by-zero":
                    return ["aritherror", "throw an arithmetic error at runtime"];
                case "aritherror":
                    return [cond, "throw an arithmetic error at runtime"];
                case "segfault":
                    return ["memerror", "throw an memory access error at runtime"];
                case "memerror":
                    return [cond, "throw an memory access error at runtime"];
                case "infloop":
                    return [cond, "never terminate"];
                case "abort":
                    return [cond, "fail an assertion at runtime"];
                case "typecheck":
                    return [cond, "successfully typecheck"];
                case "compile":
                    return [cond, "typecheck and link"];
                /* istanbul ignore next */

                default:
                    throw new Error(`Unexpected condition ${cond} (should be impossible, please report)`);
            }
        })(spec[3][0]);

        let debug = false;
        let purity = true;
        let libs: string[] = [];
        let files: string[] = [];
        let libSet: Set<string> = new Set();
        let lang: Lang | null = null;

        const flags = spec[1] ? spec[1][1] : [];
        flags.forEach((flag: any) => {
            switch (flag[0][0]) {
                case "-l": {
                    const lib = flag[0][1].join("");
                    if (libSet.has(lib)) throw new Error(`-l${lib} declared twice`);
                    libs.push(lib);
                    libSet = libSet.add(lib);
                    break;
                }
                case "-f": {
                    const filedep = flag[0][1].join("");
                    files.push(filedep);
                    break;
                }
                case "-d": {
                    if (debug) throw new Error(`-d declared twice`);
                    debug = true;
                    break;
                }
                case "--no-purity-check": {
                    if (!purity) throw new Error(`--no-purity-check declared twice`);
                    purity = false;
                    break;
                }
                case "--standard": {
                    const std = flag[0][4].join("");
                    if (lang !== null) throw new Error(`Multiple language standards ${lang} and ${std}`);
                    lang = parseLang(std);
                    /* istanbul ignore next */
                    if (lang === null)
                        throw new Error(
                            `Unknown language standard ${std} (should be impossible, please report)`
                        );
                    break;
                }
                /* istanbul ignore next */
                default: {
                    throw new Error(`Unknown directive ${flag[0][0]} (should be impossible, please report)`);
                }
            }
        });

        return {
            outcome: outcome[0],
            description: outcome[1],
            debug: debug,
            purity: purity,
            libs: libs,
            files: files,
            lang: lang ? lang : defaultLang
        };
    });
}
