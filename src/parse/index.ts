import { Grammar, Parser } from "nearley";
import { TypeLexer } from "../lex";
import { restrictExpression, restrictDeclaration, restrictStatement } from "./restrictsyntax";
import { Lang } from "../lang";
import * as ast from "../ast";
import * as parsed from "./parsedsyntax";
import { ImpossibleError, IncompleteParseError } from "../error";

const expressionRules = require("../../lib/expression-rules");
const statementRules = require("../../lib/statement-rules");
const programRules = require("../../lib/program-rules");

/**
 * Parses a string as a C0 expression.
 *
 * @param str The string to parse as a C0 expression.
 * @param options.lang The language standard to parse. (Default C1)
 * @param options.types The set of strings to interpret as type identifiers.
 *
 * @throws IncompleteParseError if the parse is not a valid C0 expression,
 * but could be extended into a valid C0 expression.
 */
export function parseExpression(str: string, options?: { lang?: Lang; types?: Set<string> }): ast.Expression {
    const opt = options ? options : {};
    const parser = new Parser(Grammar.fromCompiled(expressionRules));
    parser.lexer = new TypeLexer(opt.lang || "C1", opt.types || new Set());
    const parsed: parsed.Expression[] = parser.finish();
    if (parsed.length > 1) {
        throw new ImpossibleError("Ambiguous parse!");
    } else if (parsed.length === 0) {
        throw new IncompleteParseError("Incomplete parse");
    } else {
        return restrictExpression(opt.lang || "C1", parsed[0]);
    }
}

/**
 * Parses a string as a sequence of C0 statements.
 * NOTE: allows the final trailing semicolon to be present or absent.
 *
 * @param str The string to parse as a sequence of C0 statements.
 * @param options.lang The language standard to parse. (Default C1)
 * @param options.types The set of strings to interpret as type identifiers.
 *
 * @throws IncompleteParseError if the parse is not a valid C0 expression,
 * but could be extended into a valid C0 expression.
 */
export function parseStatement(str: string, options?: { lang?: Lang; types?: Set<string> }): ast.Statement[] {
    const opt = options ? options : {};
    const parser = new Parser(Grammar.fromCompiled(statementRules));
    parser.lexer = new TypeLexer(opt.lang || "C1", opt.types || new Set());
    parser.feed(str);
    const parsed = parser.finish();
    if (parsed.length > 1) {
        throw new ImpossibleError("Ambiguous parse!");
    } else if (parsed.length === 0) {
        throw new IncompleteParseError("Incomplete statement");
    } else {
        return parsed[0].map((x: parsed.Statement) => restrictStatement(opt.lang || "C1", x));
    }
}

function* semicolonSplit(s: string) {
    let ndx = s.indexOf(";");
    while (ndx > 0) {
        yield { last: false, segment: s.slice(0, ndx) };
        s = s.slice(ndx + 1);
        ndx = s.indexOf(";");
    }
    yield { last: true, segment: s };
}

/**
 * Parses a program into the raw syntax form.
 */
function parseProgramRaw(lang: Lang, str: string, typedefs?: Set<string>): parsed.Declaration[] {
    const parser = new Parser(Grammar.fromCompiled(programRules));
    const lexer: TypeLexer = (parser.lexer = new TypeLexer(lang, typedefs || new Set()));
    const segments = semicolonSplit(str);
    let decls: parsed.Declaration[] = [];
    let size = 0;
    for (let segment of segments) {
        parser.feed(segment.segment);
        const parsed = parser.finish();
        if (parsed.length > 1) {
            console.log("Parse ambiguous:");
            console.log(JSON.stringify(parsed[0]));
            console.log(JSON.stringify(parsed[1]));
            console.log(JSON.stringify(parsed[2]));
            console.log(JSON.stringify(parsed[3]));
            console.log(JSON.stringify(parsed[4]));
            console.log(JSON.stringify(parsed[5]));
            console.log(JSON.stringify(parsed[parsed.length - 1]));
            throw new ImpossibleError(`Internal error, parse ambiguous (${parsed.length} parses)`);
        } else if (parsed.length === 0) {
            if (segment.last) {
                throw new IncompleteParseError("Incomplete parse at the end of the file");
            } else {
                parser.feed(";");
            }
        } else {
            // parsed.length === 1
            const parsedGlobalDecls = parsed[0];
            for (let i = size; i < parsedGlobalDecls.length - 1; i++) {
                if (
                    parsedGlobalDecls[i].tag === "TypeDefinition" ||
                    parsedGlobalDecls[i].tag === "FunctionTypeDefinition"
                )
                    throw new Error(`typedef is missing its trailing semicolon`);
            }
            if (segment.last) {
                if (parsedGlobalDecls.length > size) {
                    const possibleTypeDef: ast.Declaration = parsedGlobalDecls[parsedGlobalDecls.length - 1];
                    if (
                        possibleTypeDef.tag === "TypeDefinition" ||
                        possibleTypeDef.tag === "FunctionTypeDefinition"
                    )
                        throw new Error(`typedef without a final semicolon at the end of the file`);
                }
                decls = decls.concat(parsedGlobalDecls);
            } else {
                if (parsedGlobalDecls.length === 0) throw new Error(`semicolon at beginning of file`);

                const possibleTypedef: ast.Declaration = parsedGlobalDecls[parsedGlobalDecls.length - 1];
                if (parsedGlobalDecls.length === size)
                    throw new Error(`too many semicolons after a ${possibleTypedef.tag}`);
                size = parsedGlobalDecls.length;

                switch (possibleTypedef.tag) {
                    case "TypeDefinition":
                    case "FunctionTypeDefinition": {
                        lexer.addIdentifier(possibleTypedef.definition.id.name);
                        break;
                    }
                    default:
                        throw new Error(
                            `unnecessary semicolon at the top level after ${possibleTypedef.tag}`
                        );
                }
                parser.feed(" ");
            }
        }
    }

    // code quality: ought to to make this impossible; return in loop
    return decls;
}

/**
 * Parses a program as a series of C0 statements.
 * NOTE: allows the final trailing semicolon to be present or absent.
 *
 * @param str The string to parse as a C0 program.
 * @param options.lang The language standard to parse. (Default C1)
 * @param options.types The set of strings to interpret as type identifiers.
 *
 * @throws IncompleteParseError if the parse is not a valid C0 expression,
 * but could be extended into a valid C0 expression.
 */
export function parseProgram(lang: Lang, str: string, typedefs?: Set<string>): ast.Declaration[] {
    return parseProgramRaw(lang, str, typedefs).map(decl => {
        return restrictDeclaration(lang, decl);
    });
}
