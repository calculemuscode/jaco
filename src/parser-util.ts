import { Token } from "moo";
import * as ast from "./ast";
import * as parsed from "./parsedsyntax";

export function Identifier([{ value, text, offset, lineBreaks, line, col }]: Token[]) {
    return {
        tag: "Identifier",
        name: text
    };
}

export function IntLiteral([{ value, text, offset, lineBreaks, line, col }]: Token[]) {
    return {
        tag: "IntLiteralExpression",
        value: 0,
        raw: text
    };
}

export function CharLiteral([tokens]: [[Token, [Token], Token]]) {
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
}

export function StringLiteral([start, toks, end]: [Token, [Token][], Token]): ast.StringLiteral {
    return {
        tag: "StringLiteral",
        value: "Hello, World!",
        raw: "\"Hello, World!\""
    }
}

export function BoolLiteral(t: Token): ast.BoolLiteral {
    return {
        tag: "BoolLiteral",
        value: t.value === "true"
    }
}

export function NullLiteral(): ast.NullLiteral {
    return {
        tag: "NullLiteral"
    }
}

export function UnaryExpression([operator, s, argument]: [any[], Token, parsed.Expression]):
    | parsed.UnaryExpression
    | parsed.CastExpression {
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
}

export function BinaryExpression([left, s1, opertoks, s2, right]: [
    parsed.Expression,
    any,
    Token[],
    any,
    parsed.Expression
]): parsed.BinaryExpression | parsed.LogicalExpression | parsed.AssignmentExpression {
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

export function FunctionDecl([ty, s1, f, s2, args, annos, s3, def]: [parsed.Type, any, ast.Identifier, any, any, any, any, [Token | parsed.Statement]]): string | parsed.Statement {
    // This is quite inelegant Typescript
    if ((def[0] as Token).value === ";") return `define function ${f.name}`;
    return (def[0] as parsed.Statement);
}

export function SimpleStatement([stm, s1, semi]: [parsed.Expression | [parsed.Type, any, ast.Identifier, any], any, Token]): parsed.VariableDeclaration | parsed.ExpressionStatement {
    if (stm instanceof Array) {
        return {
            tag: "VariableDeclaration",
            kind: stm[0],
            id: stm[2],
            init: stm[3] === null ? null : stm[3][4]
        }
    } else {
        return {
            tag: "ExpressionStatement",
            expression: stm
        }
    }
}

export function WhileStatement() {
    return { tag: "BreakStatement" };
}

export function ForStatement() {
    return { tag: "BreakStatement" };
}

export function IfStatement() {
    return { tag: "BreakStatement" };
}

export function ReturnStatement() {
    return { tag: "BreakStatement" };
}

export function BlockStatement([l, stms, annos, s, r]: [Token, [any, any][], any[], any, Token]): parsed.BlockStatement {
    return {
        tag: "BlockStatement",
        body: stms.map(x => x[1][1])
    };
}

export function BreakStatement([stm, s1, semi]: [Token, any, Token]): ast.BreakStatement {
    return { tag: "BreakStatement" };
}

export function ContinueStatement([stm, s1, semi]: [Token, any, Token]): ast.ContinueStatement {
    return { tag: "ContinueStatement" };
}
