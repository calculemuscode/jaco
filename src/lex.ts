import { states, Token, Lexer, LexerState } from "moo";
import { Set } from "immutable";

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
    unexpected_unicode_character: { match: /[\x00-\u{10FFFF}]/, lineBreaks: true }, // ugh linebreaks
    invalid_character: { match: /./, lineBreaks: true }, // ugh linebreaks
    type_identifier: "<placeholder>",
    space: "<placeholder>"
};

export const coreLexer: Lexer = states(
    {
        main: Object.assign(
            {
                newline: { match: /\r\n|\r|\n/, lineBreaks: true },
                whitespace: { match: /[ \t\v\f]+/ },
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
                newline: { match: /\r\n|\r|\n/, lineBreaks: true },
                whitespace: { match: /[ \t\v\f]+/ },
                anno_end: { match: "@*/", pop: 1 },
                comment_start: { match: "/*", push: "multiLineComment" },
                comment_line_start: { match: "//", push: "lineComment" },
                annospace: { match: "@" }
            },
            basicLexing
        ),
        lineAnno: Object.assign(
            {
                anno_end: { match: /\r\n|\r|\n/, pop: 1, lineBreaks: true },
                whitespace: { match: /[ \t\v\f]+/ },
                comment_start: { match: "/*", push: "multiLineComment" },
                comment_line_start: { match: "//", next: "lineComment" },
                annospace: { match: "@" }
            },
            basicLexing
        ),
        stringComponents: {
            string_delimiter: { match: /"/, pop: 1 },
            characters: { match: /[^\\\n\r"]+/, lineBreaks: false },
            special_character: { match: /\\[^\n\r]/, lineBreaks: false },
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
            comment: { match: /\*|\/|[^*\/\r\n]+/, lineBreaks: false },
            newline: { match: /\n|\r|\r\n/, lineBreaks: true }
        },
        lineComment: {
            comment: { match: /[^\n\r]/, lineBreaks: false },
            comment_line_end: { match: /\n|\r|\r\n/, lineBreaks: true, pop: 1 }
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
        this.typeIds = this.typeIds.add(typeIdentifier);
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