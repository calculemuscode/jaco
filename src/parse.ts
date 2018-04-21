import { List, Set } from "immutable";
import { TypeLexer } from "./lex";
import { Grammar, Parser } from "nearley";
import { restrictStatement } from "./restrictsyntax";
import { Lang } from "./lang";
import * as ast from "./ast";
import * as parsed from "./parsedsyntax";
//const expressionRules = require("../lib/expression-rules");
//const statementRules = require("../lib/statement-rules");
const programRules = require("../lib/program-rules");

export function parseExpression(str: string, options?: { types?: Set<string> }) {
    return;
}

export function parseStatement(str: string, options?: { types?: Set<string>; lang: Lang }) {
    programRules.lexer = new TypeLexer(options ? options.types : undefined);
    const parser = new Parser(Grammar.fromCompiled(programRules));
    parser.feed(str);
    return restrictStatement;
}

export function parseProgram(str: string): List<string | ast.Statement> {
    const parser = new Parser(Grammar.fromCompiled(programRules));
    const lexer: TypeLexer = parser.lexer = new TypeLexer();
    const segments = str.split(";");
    let decls: List<string | parsed.Statement> = List<any>();
    segments.forEach((segment, index) => {
        parser.feed(segment);
        const parsed = parser.finish();
        if (parsed.length > 1) {
            console.log(JSON.stringify(parsed[0]));
            console.log(JSON.stringify(parsed[parsed.length - 1]));
            throw new Error(`Parse ambiguous (${parsed.length} parses)`);
        } else if (parsed.length === 0) {
            if (index === segments.length - 1) {
                throw new Error("Incomplete parse at the end of the file");
            } else {
                console.log(` -- continuing to parse`);
                parser.feed(";");
            }
        } else {
            // parsed.length === 1
            if (index === segments.length - 1) {
                console.log(` -- end`);
                decls = decls.concat(parsed[0]);    
            } else {
                const parsedGlobalDecls = parsed[0];
                decls = decls.concat(parsedGlobalDecls);
                const possibleTypedef = parsedGlobalDecls[parsedGlobalDecls.length - 1];
                console.log(possibleTypedef);
                // TODO: check that it's a typedef
                console.log(` -- typedef ${possibleTypedef[1]}`);
                const typeIdentifier = possibleTypedef[1];
                lexer.addIdentifier(typeIdentifier);
                parser.feed(" ");
            }
        }
    });

    return decls.map(decl => {
        if (typeof decl === "string") return decl;
        if (decl instanceof Array) return decl[0] as string;
        return restrictStatement("C1", decl);
    });
}
