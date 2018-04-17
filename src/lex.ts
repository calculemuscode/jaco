import { states, Token, Lexer, LexerState } from "moo";
import { Set } from "immutable";
import * as ast from "./ast";
import * as parsed from "./parsedsyntax";

/**
 * Ambitious Goal: "invalid syntax" errors from the lexer are unclear. Can we take errors out of the lexer to
 * the point we can clearly enumerate all files that will _not_ be accepted by the lexer? This would also
 * facilitate.
 *
 * All UTF-8 strings should lex, unless they:
 *  1. Contain non-printable characters.
 *  2. Contain the character ` outside of a string/char/comment.
 *  3. Contain characters outside of the UTF-8 range.
 */
const basicLexing = {
    whitespace: { match: /[ \t\n\v\f\r]+/, lineBreaks: true },
    identifier: {
        match: /[A-Za-z_][A-Za-z0-9_]*/,
        keywords: {
            keyword: [
                "int",
                "bool",
                "string",
                "char",
                "void",
                "struct",
                "typedef",
                "if",
                "else",
                "while",
                "for",
                "continue",
                "break",
                "return",
                "assert",
                "error",
                "true",
                "false",
                "NULL",
                "alloc",
                "alloc_array"
            ]
        }
    },
    numeric_literal: { match: /(?:0[xX][0-9a-zA-Z]+)|(?:[1-9][0-9]*)|0/ },
    char_delimiter: { match: /'/, push: "charComponents" },
    string_delimiter: { match: /\"/, push: "stringComponents" },
    logical_and: "&&",
    symbol: /[!$%&\(\)*+,\-.\/:;<=>?\[\\\]^{\|}~]/,
    unexpected_unicode_character: { match: /[\x00-\u{10FFFF}]/, lineBreaks: true },
    invalid_character: { match: /./, lineBreaks: true },
    type_identifier: "<placeholder>",
    space: "<placeholder>"
};

export const coreLexer: Lexer = states(
    {
        main: Object.assign(
            {
                anno_start: { match: "/*@", push: "multiLineAnno" },
                comment_start: { match: "/*", push: "multiLineComment" },
                anno_line_start: { match: "//@", push: "lineAnno" },
                comment_line_start: { match: "//", push: "lineComment" },
                pragma: /#.*/
            },
            basicLexing
        ),
        multiLineAnno: Object.assign(
            {
                anno_end: { match: "@*/", pop: 1 },
                comment_start: { match: "/*", push: "multiLineComment" },
                comment_line_start: { match: "//", push: "lineComment" },
                whitespace: { match: /[ \t\n\v\f\r]+/, lineBreaks: true },
                annospace: { match: "@" }
            },
            basicLexing
        ),
        lineAnno: Object.assign(
            {
                anno_end: { match: "\n", pop: 1, lineBreaks: true },
                comment_start: { match: "/*", push: "multiLineComment" },
                comment_line_start: { match: "//", next: "lineComment" },
                whitespace: { match: /[ \t\v\f\r]+/ },
                annospace: { match: "@" }
            },
            basicLexing
        ),
        stringComponents: {
            string_delimiter: { match: /"/, pop: 1 },
            characters: { match: /[^\\\n"]+/, lineBreaks: false },
            special_character: { match: /\\./, lineBreaks: true },
            invalid_string_character: { match: /[\x00-xFF]/, lineBreaks: true }
        },
        charComponents: {
            char_delimiter: { match: /'/, pop: 1 },
            special_character: { match: /\\./, lineBreaks: true },
            character: { match: /./, lineBreaks: false },
            invalid_string_character: { match: /[\x00-xFF]/, lineBreaks: true, pop: 1 }
        },
        multiLineComment: {
            comment_start: { match: "/*", push: "multiLineComment" },
            comment_end: { match: "*/", pop: 1 },
            comment: { match: /\*|\/|[^*\/]+/, lineBreaks: true }
        },
        lineComment: {
            comment: { match: /[^\n]/, lineBreaks: false },
            comment_line_end: { match: /\n/, lineBreaks: true, pop: 1 }
        }
    },
    "main"
);

export class TypeLexer {
    private typeIds = Set<string>();
    constructor(typeIds?: Set<string>) {
        this.typeIds = typeIds ? typeIds : Set();
    }
    addIdentifier(typeIdentifier: string) {
        this.typeIds = this.typeIds.add(typeIdentifier)
    }
    next(): Token | undefined {
        const tok = coreLexer.next();
        if (!tok) return undefined;
        else if (tok["type"] === "identifier" && this.typeIds.has(tok.value)) {
            tok["type"] = "type_identifier";
            return tok;
        } else if (tok["type"] === "identifier") {
            return tok;
        } else {
            return tok;
        }
    }
    save(): LexerState {
        return coreLexer.save();
    }
    reset(chunk?: string, state?: LexerState): void {
        coreLexer.reset(chunk, state);
    }
    formatError(token: Token, message?: string): string {
        return coreLexer.formatError(token, message);
    }
    has(tokenType: string): boolean {
        return coreLexer.has(tokenType);
    }
}

export const lexer = new TypeLexer();

export const util = {
    Identifier: ([{ value, text, offset, lineBreaks, line, col }]: Token[]) => {
        return {
            tag: "Identifier",
            name: text
        };
    },
    IntLiteral: ([{ value, text, offset, lineBreaks, line, col }]: Token[]) => {
        return {
            tag: "IntLiteralExpression",
            value: 0,
            raw: text
        };
    },
    CharLiteral: ([tokens]: [[Token, [Token], Token]]) => {
        if (tokens.length !== 3) {
            throw new Error("Bad character literal");
        }
        if (tokens[0]["type"] !== "char_delimiter" || tokens[2]["type"] !== "char_delimiter") {
            throw new Error("Invalid char terminator");
        }
        const char = tokens[1][0];
        if (char["type"] === "character") {
            if (!char.value.match(/[ !#-~]/)) {
                throw new Error("Invalid character");
            }
            return {
                tag: "CharLiteralExpression",
                value: char.value,
                raw: `'${char.value}'`
            };
        } else if (char["type"] === "special_character") {
            if (!char.value.match(/\\[ntvbrfa\\'"0]/)) {
                throw new Error("Invalid character escape sequence");
            }
            return {
                tag: "CharLiteralExpression",
                value: char.value,
                raw: `'${char.value}'`
            };
        } else {
            throw new Error("Bad character literal");
        }
    },
    UnaryExpression: ([operator, s, argument]: [any[], Token, ast.Expression]):
        | ast.UnaryExpression
        | ast.CastExpression => {
        if (operator.length == 0) {
            switch (operator[0].value) {
                case "&":
                case "!":
                case "~":
                case "-":
                case "*":
                    return {
                        tag: "UnaryExpression",
                        operator: operator[0].value,
                        argument: argument
                    };

                default:
                    throw new Error(operator[0].value);
            }
        } else {
            return {
                tag: "CastExpression",
                kind: operator[2],
                argument: argument
            };
        }
    },
    BinaryExpression: ([left, s1, opertoks, s2, right]: [
        parsed.Expression,
        Token,
        Token[],
        Token,
        parsed.Expression
    ]): parsed.BinaryExpression | parsed.LogicalExpression | parsed.AssignmentExpression => {
        const operator = opertoks.map((tok: Token) => tok.text).join("");
        switch (operator) {
            case "*":
            case "/":
            case "%":
            case "+":
            case "-":
            case "<<":
            case ">>":
            case "<":
            case "<=":
            case ">=":
            case ">":
            case "==":
            case "!=":
            case "&":
            case "^":
            case "|":
                return {
                    tag: "BinaryExpression",
                    operator: operator,
                    left: left,
                    right: right
                };
            case "&&":
            case "||":
                return {
                    tag: "LogicalExpression",
                    operator: operator,
                    left: left,
                    right: right
                };
            case "=":
            case "+=":
            case "-=":
            case "*=":
            case "/=":
            case "%=":
            case "&=":
            case "^=":
            case "|=":
            case "<<=":
            case ">>=":
                return {
                    tag: "AssignmentExpression",
                    operator: operator,
                    left: left,
                    right: right
                };

            default:
                throw new Error(operator);
        }
    }
};
