/**
 * Parse spec according to the grammar in tests/README.md
 */

 import Lang from "../lang";
import { Parser, Grammar } from "nearley";
const testSpecRules = require("../../lib/test/spec-rules");

export type Outcome =
    | number
    | "error_parse"
    | "error_typecheck"
    | "error_static"
    | "error_runtime"
    | "error"
    | "aritherror"
    | "memerror"
    | "infloop"
    | "abort"
    | "typecheck";
export interface Spec {
    key: Outcome;
    description: string;
    debug: boolean;
    purity: boolean;
    libs: string[];
    lang: Lang;
}

export function parseSpec(defaultLang: Lang, spec: string): Spec[] {
    let specs;
    try {
        const specParser = new Parser(Grammar.fromCompiled(testSpecRules));
        specParser.feed(spec);
        specs = specParser.finish();
    } catch (err) {
        throw new Error(`Error parsing test spec:\n${err}`);
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
                    return [parseInt(retVal), `return ${retVal}`];
                }
                case "error_parse":
                    return [cond, "fail during parsing"];
                case "error_typecheck":
                    return [cond, "fail checking static semantics"];
                case "error_static":
                    return [cond, "fail checking static semantics"];
                case "error_runtime":
                    return [cond, "fail checking static semantics"];
                case "error":
                    return [cond, "fail somehow"];
                case "div-by-zero":
                    return ["aritherror", "throw an arithmetic error at runtime"];
                case "aritherror":
                    return [cond, "throw an arithmetic error at runtime"];
                case "segfault":
                    return ["memerror", "throw an memory access error at runtime"];
                case "memerror":
                    return ["memerror", "throw an memory access error at runtime"];
                case "infloop":
                    return [cond, "never terminate"];
                case "abort":
                    return [cond, "fail an assertion at runtime"];
                case "typecheck":
                    return [cond, "successfully typecheck"];
                default:
                    throw new Error(`Unexpected condition ${cond}`);
            }
        })(spec[3][0]);

        return {
            key: outcome[0],
            description: outcome[1],
            debug: false,
            purity: true,
            libs: [],
            lang: defaultLang
        };
    });
}
