/**
 * Consumes (and documents) the messy output produced by the parser, and turns it into parsedsyntax.ts types. This file could easily produce garbage output if there's a mismatch between the documented types and the types that the parser produces. This file should only throw errors to document invariants of the parser; user errors should be thrown in restrictsyntax.ts.
 *
 * The structure of this file should match parsedsyntax.ts as much as practical.
 */

import { Token } from "moo";
import * as ast from "./ast";
import * as parsed from "./parsedsyntax";

export function Identifier([{ value, text, offset, lineBreaks, line, col }]: Token[]): ast.Identifier {
    return {
        tag: "Identifier",
        name: text
    };
}

export function IntLiteral([{ value, text, offset, lineBreaks, line, col }]: Token[]): parsed.IntLiteral {
    return {
        tag: "IntLiteral",
        raw: text
    };
}

export function CharLiteral([[start, [tok], end]]: [[Token, [Token], Token]]): parsed.CharLiteral {
    return {
        tag: "CharLiteral",
        raw: tok.value
    };
}

export function StringLiteral([[start, toks, end]]: [[Token, [Token][], Token]]): parsed.StringLiteral {
    return {
        tag: "StringLiteral",
        raw: toks.map(x => x[0].value)
    };
}

export function BoolLiteral([t]: [Token]): ast.BoolLiteral {
    return {
        tag: "BoolLiteral",
        value: t.value === "true"
    };
}

export function NullLiteral(): ast.NullLiteral {
    return {
        tag: "NullLiteral"
    };
}

export function ArrayMemberExpression([object, s1, l, s2, index, s3, r]: [
    parsed.Expression,
    any,
    Token,
    any,
    parsed.Expression,
    any,
    Token
]): parsed.ArrayMemberExpression {
    return {
        tag: "ArrayMemberExpression",
        object: object,
        index: index
    };
}

export type Arguments = [
    Token,
    any,
    null | [parsed.Expression, any, [Token, any, parsed.Expression][]],
    Token
];

export function Arguments([l, s1, args, r]: Arguments): parsed.Expression[] {
    if (args === null) return [];
    return [args[0]].concat(args[2].map(x => x[2]));
}

export function StructMemberExpression([object, s1, deref, s2, field]: [
    parsed.Expression,
    any,
    [Token, Token] | Token,
    any,
    ast.Identifier
]): parsed.StructMemberExpression {
    return {
        tag: "StructMemberExpression",
        deref: deref instanceof Array, // ["-", ">"] vs. "."
        object: object,
        field: field
    };
}

export function CallExpression([f, ws, args]: [ast.Identifier, any, Arguments]): parsed.CallExpression {
    return {
        tag: "CallExpression",
        callee: f,
        arguments: Arguments(args)
    };
}

export function IndirectCallExpression([l, s1, s, s2, f, s3, r, s4, args]: [
    Token,
    any,
    Token,
    any,
    parsed.Expression,
    any,
    Token,
    any,
    Arguments
]): parsed.IndirectCallExpression {
    return {
        tag: "IndirectCallExpression",
        callee: f,
        arguments: Arguments(args)
    };
}

export function UnaryExpression([operator, s, argument]: [any[], Token, parsed.Expression]):
    | parsed.UnaryExpression
    | parsed.CastExpression {
    if (operator.length == 1) {
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

export function ConditionalExpression([test, s1, op1, s2, consequent, s3, op2, s4, alternate]: [
    parsed.Expression,
    any,
    any,
    any,
    parsed.Expression,
    any,
    any,
    any,
    parsed.Expression
]): parsed.ConditionalExpression {
    return {
        tag: "ConditionalExpression",
        test: test,
        consequent: consequent,
        alternate: alternate
    };
}

export function AllocExpression([alloc, s1, l, s2, typ, s3, r]: [
    Token,
    any,
    Token,
    any,
    parsed.Type,
    any,
    Token
]): parsed.AllocExpression {
    return {
        tag: "AllocExpression",
        kind: typ
    };
}

export function AllocArrayExpression([alloc, s1, l, s2, typ, s3, c, s4, size, sp, r]: [
    Token,
    any,
    Token,
    any,
    parsed.Type,
    any,
    Token,
    any,
    parsed.Expression,
    any,
    Token
]): parsed.AllocArrayExpression {
    return {
        tag: "AllocArrayExpression",
        kind: typ,
        size: size
    };
}

export function ResultExpression([b, res]: [Token, Token]): parsed.ResultExpression {
    return {
        tag: "ResultExpression"
    };
}

export function LengthExpression([b, length, s1, l, s2, argument, s3, r]: [
    Token,
    Token,
    any,
    Token,
    any,
    parsed.Expression,
    any,
    Token
]): parsed.LengthExpression {
    return {
        tag: "LengthExpression",
        argument: argument
    };
}

export function HasTagExpression([b, hastag, s1, l, s2, typ, s3, c, s4, argument, s5, r]: [
    Token,
    Token,
    any,
    Token,
    any,
    parsed.Type,
    any,
    Token,
    any,
    parsed.Expression,
    any,
    Token
]): parsed.HasTagExpression {
    return {
        tag: "HasTagExpression",
        kind: typ,
        argument: argument
    };
}

export function UpdateExpression([argument, s1, op1, op2]: [
    parsed.Expression,
    any,
    Token,
    Token
]): parsed.UpdateExpression {
    return {
        tag: "UpdateExpression",
        argument: argument,
        operator: op1.value === "+" ? "++" : "--"
    };
}

export function AssertExpression([assert, s1, l, s2, test, s3, r]: [
    Token,
    any,
    Token,
    any,
    parsed.Expression,
    any,
    Token
]): parsed.AssertExpression {
    return {
        tag: "AssertExpression",
        test: test
    };
}

export function ErrorExpression([error, s1, l, s2, argument, s3, r]: [
    Token,
    any,
    Token,
    any,
    parsed.Expression,
    any,
    Token
]): parsed.ErrorExpression {
    return {
        tag: "ErrorExpression",
        argument: argument
    };
}

export type SimpleParsed =
    | parsed.Expression
    | [parsed.Type, any, ast.Identifier, null | [any, Token, any, parsed.Expression]];
export function SimpleStatement([stm, s1, semi]: [SimpleParsed, any, Token]):
    | parsed.VariableDeclaration
    | parsed.ExpressionStatement {
    if (stm instanceof Array) {
        const init = stm[3];
        return {
            tag: "VariableDeclaration",
            kind: stm[0],
            id: stm[2],
            init: init === null ? null : init[3]
        };
    } else {
        return {
            tag: "ExpressionStatement",
            expression: stm
        };
    }
}

export function IfStatement([i, s1, l, s2, test, s3, r, s4, [annos, consequent]]: [
    Token,
    any,
    Token,
    any,
    parsed.Expression,
    any,
    Token,
    any,
    [parsed.Anno[], parsed.Statement]
]): parsed.IfStatement {
    return {
        tag: "IfStatement",
        test: test,
        consequent: [annos, consequent]
    };
}

export function IfElseStatement([
    i,
    s1,
    l1,
    s2,
    test,
    s3,
    r,
    annos1,
    s4,
    consequent,
    s5,
    e,
    annos2,
    s6,
    alternate
]: [
    Token,
    any,
    Token,
    any,
    parsed.Expression,
    any,
    Token,
    parsed.Anno[],
    any,
    parsed.Statement,
    any,
    Token,
    parsed.Anno[],
    any,
    parsed.Statement
]): parsed.IfStatement {
    return {
        tag: "IfStatement",
        test: test,
        consequent: [annos1, consequent],
        alternate: [annos2, alternate]
    };
}

export function WhileStatement([w, s1, l, s2, test, s3, r, annos, s4, body]: [
    Token,
    any,
    Token,
    any,
    parsed.Expression,
    any,
    Token,
    parsed.Anno[],
    any,
    parsed.Statement
]): parsed.WhileStatement {
    return {
        tag: "WhileStatement",
        test: test,
        body: [annos, body]
    };
}

export function ForStatement([
    f,
    s1,
    l,
    init,
    s2,
    semi1,
    s3,
    test,
    s4,
    semi2,
    update,
    s5,
    r,
    annos,
    s6,
    body
]: [
    Token,
    any,
    Token,
    null | [any, SimpleParsed],
    any,
    Token,
    any,
    parsed.Expression,
    any,
    Token,
    null | [any, parsed.Expression],
    any,
    Token,
    parsed.Anno[],
    any,
    parsed.Statement
]): parsed.ForStatement {
    return {
        tag: "ForStatement",
        init: init === null ? null : SimpleStatement([init[1], s2, semi1]),
        test: test,
        update: update === null ? null : update[1],
        body: [annos, body]
    };
}

export function ReturnStatement([r, argument, s1, semi]: [
    Token,
    null | [any, parsed.Expression],
    any,
    Token
]): parsed.ReturnStatement {
    return {
        tag: "ReturnStatement",
        argument: argument === null ? null : argument[1]
    };
}

export function BlockStatement([l, stms, annos, s, r]: [
    Token,
    [any, [parsed.Anno[], parsed.Statement]][],
    [any, [parsed.Anno]][],
    any,
    Token
]): parsed.BlockStatement {
    const stms1: parsed.Statement[][] = stms.map(x =>
        x[1][0].map((y): parsed.Statement => ({ tag: "AnnoStatement", anno: y })).concat([x[1][1]])
    );
    const stms2: parsed.Statement[] = annos.map((x): parsed.Statement => ({
        tag: "AnnoStatement",
        anno: x[1][0]
    }));
    const stmsAll: parsed.Statement[] = stms1
        .concat([stms2])
        .reduce((collect, stms) => collect.concat(stms), []);

    return {
        tag: "BlockStatement",
        body: stmsAll
    };
}

export function BreakStatement([stm, s1, semi]: [Token, any, Token]): ast.BreakStatement {
    return { tag: "BreakStatement" };
}

export function ContinueStatement([stm, s1, semi]: [Token, any, Token]): ast.ContinueStatement {
    return { tag: "ContinueStatement" };
}

export function Anno1(
    annos: [Token, any, parsed.Anno[], any, Token] | [Token, any, parsed.Anno[], any, Token, any[], Token]
): parsed.Anno[] {
    const start: Token = annos[0];
    const end: Token = annos[6] ? annos[6] : annos[4];
    if (start.type === "anno_line_start" && start.line !== end.line)
        throw new Error(
            `Single-line annotations cannot be extended onto multiple lines with multiline comments.`
        );
    return annos[2];
}

export function FunctionDecl([ty, s1, f, s2, args, annos, s3, def]: [
    parsed.Type,
    any,
    ast.Identifier,
    any,
    any,
    parsed.Anno[],
    any,
    [Token | parsed.Statement]
]): string | parsed.Statement {
    // This is quite inelegant Typescript
    if ((def[0] as Token).value === ";") return `define function ${f.name}`;
    return def[0] as parsed.Statement;
}
