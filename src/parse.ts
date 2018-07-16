import { List, Set } from "immutable";
import { TypeLexer } from "./lex";
import { Grammar, Parser } from "nearley";
import { restrictExpression, restrictDeclaration } from "./restrictsyntax";
import Lang from "./lang";
import * as ast from "./ast";
import * as parsed from "./parsedsyntax";
const expressionRules = require("../lib/expression-rules");
//const statementRules = require("../lib/statement-rules");
const programRules = require("../lib/program-rules");
export function parseExpression(str: string, options?: { lang?: Lang; types?: Set<string> }): ast.Expression {
    const opt = options ? options : {};
    const parser = new Parser(Grammar.fromCompiled(expressionRules));
    parser.lexer = new TypeLexer(opt.types || Set());
    parser.feed(str);
    const parsed: parsed.Expression[] = parser.finish();
    if (parsed.length > 1) {
        throw new Error("Ambiguous parse!");
    } else if (parsed.length === 0) {
        throw new Error("Incomplete parse");
    } else {
        return restrictExpression(opt.lang || "C1", parsed[0]);
    }
}

/*
export function parseStatement(str: string, options?: { types?: Set<string>; lang: Lang }) {
    programRules.lexer = new TypeLexer(options && options.types ? options.types : Set<string>());
    const parser = new Parser(Grammar.fromCompiled(programRules));
    parser.feed(str);
    return restrictStatement;
}
*/

export function parseProgramRaw(str: string): List<parsed.Declaration> {
    const parser = new Parser(Grammar.fromCompiled(programRules));
    const lexer: TypeLexer = (parser.lexer = new TypeLexer(Set()));
    const segments = str.split(";");
    let decls: List<parsed.Declaration> = List();
    let size = 0;
    segments.forEach((segment, index) => {
        parser.feed(segment);
        const parsed = parser.finish();
        if (parsed.length > 1) {
            console.log("Parse ambiguous");
            console.log(JSON.stringify(parsed[0]));
            console.log(JSON.stringify(parsed[parsed.length - 1]));
            throw new Error(
                `Internal error, parse ambiguous (${parsed.length} parses) (this should not happen)`
            );
        } else if (parsed.length === 0) {
            if (index === segments.length - 1) {
                throw new Error("Incomplete parse at the end of the file");
            } else {
                //console.log(` -- continuing to parse`);
                parser.feed(";");
            }
        } else {
            // parsed.length === 1
            if (index === segments.length - 1) {
                decls = decls.concat(parsed[0]);
            } else {
                const parsedGlobalDecls = parsed[0];
                if (parsedGlobalDecls.length === 0) throw new Error(`semicolon at beginning of file`);

                const possibleTypedef: ast.Declaration = parsedGlobalDecls[parsedGlobalDecls.length - 1];
                if (parsedGlobalDecls.length === size) throw new Error(`too many semicolons after a ${possibleTypedef.tag}`)
                size = parsedGlobalDecls.length;

                switch (possibleTypedef.tag) {
                    case "TypeDefinition":
                    case "FunctionTypeDefinition": {
                        lexer.addIdentifier(possibleTypedef.definition.id.name);
                        break;
                    }
                    default: 
                        throw new Error(`unnecessary semicolon at the top level after ${possibleTypedef.tag}`);
                }
                parser.feed(" ");
            }
        }
    });

    // code quality: Rewrite to make this impossible; return in loop
    return decls;
}

export function parseProgram(lang: Lang, str: string): List<ast.Declaration> {
    return parseProgramRaw(str).map(decl => {
        return restrictDeclaration(lang, decl);
    });
}
