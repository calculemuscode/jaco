import { states, Token, Lexer, LexerState } from "moo";

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
export const coreLexer: Lexer = states({
    main: {
        comment_start: { match: "/*", push: "multiLineComment" },
        comment_line_start: { match: "//", push: "lineComment" },
        whitespace: { match: /[ \t\n\v\f\r@]+/, lineBreaks: true },
        pragma: /#.*/,
        identifier: {
            match: /[A-Za-z_][A-Za-z0-9_]*/,
            keywords: { keyword: [ "int", "bool", "string", "char", "void", "struct", "typedef", "if", "else", "while", "for", "continue", "break", "return", "assert", "error", "true", "false", "NULL", "alloc", "alloc_array"] }
        },
        numeric_literal: { match: /(?:0[xX][0-9a-zA-Z]+)|(?:[1-9][0-9]*)|0/ },
        char_delimiter: { match: /'/, push: "charComponents" },
        string_delimiter: { match: /"/, push: "stringComponents" },
        logical_and: '&&',
        symbol: /[!$%&\(\)*+,\-.\/:;<=>?\[\\\]^{\|}~]/,
        unexpected_unicode_character: { match: /[\x00-\u{10FFFF}]/, lineBreaks: true },
        invalid_character: { match: /./, lineBreaks: true },
        type_identifier: "<placeholder>",
        anno_start: "<placeholder>",
        anno_end: "<placeholder>",
        space: "<placeholder>"
    },
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
        comment_end: { match: '*/', pop: 1 },
        comment: { match: [ /[^*\/]+/, '*', '/' ], lineBreaks: true}
    },
    lineComment: {
        comment: { match: /[^\n]/, lineBreaks: false },
        comment_end: { match: /\n/, lineBreaks: true, pop: 1 }
    }
}, "main");

export let typeIdentifiers: Set<string> = new Set();

export const pickyLexer = {
    next: (): Token | undefined => {
        const tok = coreLexer.next();
        if (!tok) return undefined;
        else if (tok["type"] === "identifier" && typeIdentifiers.has(tok.value)) {
            tok["type"] = "type_identifier";
            return tok;
        } else if (tok["type"]!.startsWith("comment")) {
            tok["type"] = "comment";
            tok["value"] = " ";
            return tok;
        } else {
            return tok;
        }
    },
    save: (): LexerState => coreLexer.save(),
    reset: (chunk?: string, state?: LexerState): void => coreLexer.reset(chunk, state),
    formatError: (token: Token, message?: string): string => coreLexer.formatError(token, message),
    has: (tokenType: string): boolean => coreLexer.has(tokenType)
}
