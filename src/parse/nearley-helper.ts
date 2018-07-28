/**
 * This is where most of the bodies are buried.
 *
 * Consumes (and sort-of documents) the messy output produced by the parser, and turns it into parsedsyntax.ts
 * types. This file will produce garbage output if there's a mismatch between the documented types and the
 * types that the parser produces, since Typescript refuses to document that.
 *
 * Convention: this file should ***only throw errors to document invariants of the parser***
 * Any non-implementation (user-facing) errors should be thrown in restrictsyntax.ts.
 *
 * The structure of this file should match ast.ts as much as practical.
 */

import { Token } from "moo";
import { impossible } from "@calculemus/impossible";
import * as ast from "../ast";
import * as parsed from "./parsedsyntax";

// This is incorrect, but Typescript doesn't check anyway
// If whitespace gets captured or analyzed in the future this needs revisiting
export type WS = { contents: (Token | WS)[] };

export function Identifier([tok]: [Token]): ast.Identifier {
    return {
        tag: "Identifier",
        name: tok.text,
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function IntType([tok]: [Token]): ast.IntType {
    return {
        tag: "IntType",
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function BoolType([tok]: [Token]): ast.BoolType {
    return {
        tag: "BoolType",
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function StringType([tok]: [Token]): ast.StringType {
    return {
        tag: "StringType",
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function CharType([tok]: [Token]): ast.CharType {
    return {
        tag: "CharType",
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function VoidType([tok]: [Token]): ast.VoidType {
    return {
        tag: "VoidType",
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function PointerType([tp, s, tok]: [ast.Type, WS, Token]): ast.PointerType {
    return {
        tag: "PointerType",
        argument: tp,
        range: tp.range && [tp.range[0], tok.offset + tok.text.length]
    };
}

export function ArrayType([tp, s1, l, s2, r]: [ast.Type, WS, Token, WS, Token]): ast.ArrayType {
    return {
        tag: "ArrayType",
        argument: tp,
        range: tp.range && [tp.range[0], r.offset + r.text.length]
    };
}

export function StructType([str, s, id]: [Token, WS, ast.Identifier]): ast.StructType {
    return {
        tag: "StructType",
        id: id,
        range: id.range && [str.offset, id.range[1]]
    };
}

export function IntLiteral([tok]: Token[]): parsed.IntLiteral {
    return {
        tag: "IntLiteral",
        raw: tok.text,
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function StringLiteral([[start, toks, end]]: [[Token, [Token][], Token]]): parsed.StringLiteral {
    return {
        tag: "StringLiteral",
        raw: toks.map(x => x[0].value),
        range: [start.offset, end.offset + end.text.length]
    };
}

export function CharLiteral([[start, [tok], end]]: [[Token, [Token], Token]]): parsed.CharLiteral {
    return {
        tag: "CharLiteral",
        raw: tok.value,
        range: [start.offset, end.offset + end.text.length]
    };
}

export function BoolLiteral([tok]: [Token]): ast.BoolLiteral {
    return {
        tag: "BoolLiteral",
        value: tok.value === "true",
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function NullLiteral([tok]: [Token]): ast.NullLiteral {
    return {
        tag: "NullLiteral",
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function ArrayMemberExpression([object, s1, l, s2, index, s3, r]: [
    parsed.Expression,
    WS,
    Token,
    WS,
    parsed.Expression,
    WS,
    Token
]): parsed.ArrayMemberExpression {
    return {
        tag: "ArrayMemberExpression",
        object: object,
        index: index,
        range: object.range && [object.range[0], r.offset + r.text.length]
    };
}

export function StructMemberExpression([object, s1, deref, s2, field]: [
    parsed.Expression,
    WS,
    [Token, Token] | Token,
    WS,
    ast.Identifier
]): parsed.StructMemberExpression {
    return {
        tag: "StructMemberExpression",
        deref: deref instanceof Array, // ["-", ">"] vs. "."
        object: object,
        field: field,
        range: object.range && field.range && [object.range[0], field.range[1]]
    };
}

/**
 * Helper type and helper function for function arguments
 */
export type Arguments = [WS, null | [parsed.Expression, [WS, Token, WS, parsed.Expression][], WS]];

export function Arguments([s1, args]: Arguments): parsed.Expression[] {
    if (args === null) return [];
    return [args[0]].concat(args[1].map(x => x[3]));
}

export function CallExpression([f, ws, l, args, r]: [
    ast.Identifier,
    WS,
    Token,
    Arguments,
    Token
]): parsed.CallExpression {
    return {
        tag: "CallExpression",
        callee: f,
        arguments: Arguments(args),
        range: f.range && [f.range[0], r.offset + r.text.length]
    };
}

export function IndirectCallExpression([l1, s1, s, s2, f, s3, r1, s4, l2, args, r2]: [
    Token,
    WS,
    Token,
    WS,
    parsed.Expression,
    WS,
    Token,
    WS,
    Token,
    Arguments,
    Token
]): parsed.IndirectCallExpression {
    return {
        tag: "IndirectCallExpression",
        callee: f,
        arguments: Arguments(args),
        range: [l1.offset, r2.offset + r2.text.length]
    };
}

export function UnaryExpression([operator, s, argument]: [
    [Token] | [Token, WS, ast.Type, WS, Token],
    Token,
    parsed.Expression
]): parsed.UnaryExpression | parsed.CastExpression {
    if (operator.length == 1) {
        const oper = operator[0];
        switch (oper.value) {
            case "&":
            case "!":
            case "~":
            case "-":
            case "*":
                return {
                    tag: "UnaryExpression",
                    operator: oper.value,
                    argument: argument,
                    range: argument.range && [oper.offset, argument.range[1]]
                };

            default:
                throw new Error(operator[0].value);
        }
    } else {
        return {
            tag: "CastExpression",
            kind: operator[2],
            argument: argument,
            range: argument.range && [operator[0].offset, argument.range[1]]
        };
    }
}

export function BinaryExpression([left, s1, opertoks, s2, right]: [
    parsed.Expression,
    WS,
    Token[],
    WS,
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
                right: right,
                range: left.range && right.range && [left.range[0], right.range[1]]
            };
        case "&&":
        case "||":
            return {
                tag: "LogicalExpression",
                operator: operator,
                left: left,
                right: right,
                range: left.range && right.range && [left.range[0], right.range[1]]
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
                right: right,
                range: left.range && right.range && [left.range[0], right.range[1]]
            };

        default:
            throw new Error(operator);
    }
}

export function ConditionalExpression([test, s1, op1, s2, consequent, s3, op2, s4, alternate]: [
    parsed.Expression,
    WS,
    Token,
    WS,
    parsed.Expression,
    WS,
    Token,
    WS,
    parsed.Expression
]): parsed.ConditionalExpression {
    return {
        tag: "ConditionalExpression",
        test: test,
        consequent: consequent,
        alternate: alternate,
        range: test.range && alternate.range && [test.range[0], alternate.range[1]]
    };
}

export function AllocExpression([alloc, s1, l, s2, typ, s3, r]: [
    Token,
    WS,
    Token,
    WS,
    ast.Type,
    WS,
    Token
]): parsed.AllocExpression {
    return {
        tag: "AllocExpression",
        kind: typ,
        range: [alloc.offset, r.offset + r.text.length]
    };
}

export function AllocArrayExpression([alloc, s1, l, s2, typ, s3, c, s4, size, sp, r]: [
    Token,
    WS,
    Token,
    WS,
    ast.Type,
    WS,
    Token,
    WS,
    parsed.Expression,
    WS,
    Token
]): parsed.AllocArrayExpression {
    return {
        tag: "AllocArrayExpression",
        kind: typ,
        size: size,
        range: [alloc.offset, r.offset + r.text.length]
    };
}

export function ResultExpression([b, res]: [Token, Token]): parsed.ResultExpression {
    return {
        tag: "ResultExpression",
        range: [b.offset, res.offset + res.text.length]
    };
}

export function LengthExpression([b, length, s1, l, s2, argument, s3, r]: [
    Token,
    Token,
    WS,
    Token,
    WS,
    parsed.Expression,
    WS,
    Token
]): parsed.LengthExpression {
    return {
        tag: "LengthExpression",
        argument: argument,
        range: [b.offset, r.offset + r.text.length]
    };
}

export function HasTagExpression([b, hastag, s1, l, s2, typ, s3, c, s4, argument, s5, r]: [
    Token,
    Token,
    WS,
    Token,
    WS,
    ast.Type,
    WS,
    Token,
    WS,
    parsed.Expression,
    WS,
    Token
]): parsed.HasTagExpression {
    return {
        tag: "HasTagExpression",
        kind: typ,
        argument: argument,
        range: [b.offset, r.offset + r.text.length]
    };
}

/**
 * The next section are all the C0 statements that get initally parsed as expressions
 */

export function UpdateExpression([argument, s1, op]: [
    parsed.Expression,
    WS,
    [Token]
]): parsed.UpdateExpression {
    return {
        tag: "UpdateExpression",
        argument: argument,
        operator: op[0].value === "++" ? "++" : "--",
        range: argument.range && [argument.range[0], op[0].offset + op[0].text.length]
    };
}

export function AssertExpression([assert, s1, l, s2, test, s3, r]: [
    Token,
    WS,
    Token,
    WS,
    parsed.Expression,
    WS,
    Token
]): parsed.AssertExpression {
    return {
        tag: "AssertExpression",
        test: test
    };
}

export function ErrorExpression([error, s1, l, s2, argument, s3, r]: [
    Token,
    WS,
    Token,
    WS,
    parsed.Expression,
    WS,
    Token
]): parsed.ErrorExpression {
    return {
        tag: "ErrorExpression",
        argument: argument,
        range: [error.offset, r.offset + r.text.length]
    };
}

export type SimpleParsed =
    | parsed.Expression
    | [ast.Type, WS, ast.Identifier, null | [WS, Token, WS, parsed.Expression]];
export function SimpleStatement([stm, s, semi]: [SimpleParsed, WS, Token]):
    | parsed.VariableDeclaration
    | parsed.ExpressionStatement {
    if (stm instanceof Array) {
        const init = stm[3];
        return {
            tag: "VariableDeclaration",
            kind: stm[0],
            id: stm[2],
            init: init === null ? null : init[3],
            range: stm[0].range && [stm[0].range![0], semi.offset + semi.text.length]
        };
    } else {
        return {
            tag: "ExpressionStatement",
            expression: stm,
            range: stm.range && [stm.range[0], semi.offset + semi.text.length]
        };
    }
}

// Helper types for dangling-if-handling
export type AnnosAndStm = [parsed.Anno[], parsed.Statement];
export type Wrapper =
    | { tag: "while"; offset: number; test: parsed.Expression }
    | {
          tag: "for";
          offset: number;
          init: null | parsed.ExpressionStatement | parsed.VariableDeclaration;
          test: parsed.Expression;
          update: null | parsed.Expression;
      }
    | { tag: "ifelse"; offset: number; test: parsed.Expression; consequent: AnnosAndStm };

export function IfElse([tIF, s1, l, s2, test, s3, r, s4, stm, s5, tELSE, s6]: [
    Token,
    WS,
    Token,
    WS,
    parsed.Expression,
    WS,
    Token,
    WS,
    AnnosAndStm,
    WS,
    Token,
    WS
]): Wrapper {
    return {
        tag: "ifelse",
        test: test,
        consequent: stm,
        offset: tIF.offset
    };
}

export function For([tFOR, s1, l, init, s2, semi1, s3, test, s4, semi2, update, s5, r, s6]: [
    Token,
    WS,
    Token,
    null | [WS, SimpleParsed],
    WS,
    Token,
    WS,
    parsed.Expression,
    WS,
    Token,
    null | [WS, parsed.Expression],
    WS,
    Token,
    WS
]): Wrapper {
    return {
        tag: "for",
        init: init === null ? null : SimpleStatement([init[1], s2, semi1]),
        test: test,
        update: update === null ? null : update[1],
        offset: tFOR.offset
    };
}

export function While([tWHILE, s1, l, s2, test, s3, r, s4]: [
    Token,
    WS,
    Token,
    WS,
    parsed.Expression,
    WS,
    Token,
    WS
]): Wrapper {
    return { tag: "while", test: test, offset: tWHILE.offset };
}

export function Statement([wrappers, annos, stm]: [
    [parsed.Anno[], Wrapper][],
    parsed.Anno[],
    [parsed.Statement]
]): AnnosAndStm {
    return wrappers.reduceRight<AnnosAndStm>(
        (stm, [newannos, wrap]) => {
            switch (wrap.tag) {
                case "ifelse":
                    return [
                        newannos,
                        {
                            tag: "IfStatement",
                            test: wrap.test,
                            consequent: wrap.consequent,
                            alternate: stm,
                            range: stm[1].range && [wrap.offset, stm[1].range![1]]
                        }
                    ];
                case "while":
                    return [
                        newannos,
                        {
                            tag: "WhileStatement",
                            test: wrap.test,
                            body: stm,
                            range: stm[1].range && [wrap.offset, stm[1].range![1]]
                        }
                    ];
                case "for":
                    return [
                        newannos,
                        {
                            tag: "ForStatement",
                            init: wrap.init,
                            test: wrap.test,
                            update: wrap.update,
                            body: stm,
                            range: stm[1].range && [wrap.offset, stm[1].range![1]]
                        }
                    ];
                default:
                    return impossible(wrap);
            }
        },
        [annos, stm[0]]
    );
}

export function IfStatement([tIF, s1, l, s2, test, s3, r, s4, consequent]: [
    Token,
    WS,
    Token,
    WS,
    parsed.Expression,
    WS,
    Token,
    WS,
    AnnosAndStm
]): parsed.IfStatement {
    return {
        tag: "IfStatement",
        test: test,
        consequent: consequent,
        range: consequent[1].range && [tIF.offset, consequent[1].range![1]]
    };
}

export function ReturnStatement([r, argument, s1, semi]: [
    Token,
    null | [WS, parsed.Expression],
    WS,
    Token
]): parsed.ReturnStatement {
    return {
        tag: "ReturnStatement",
        argument: argument === null ? null : argument[1],
        range: [r.offset, semi.offset + semi.text.length]
    };
}

export function BlockStatement([l, stms, annos, s, r]: [
    Token,
    [WS, [parsed.Anno[], parsed.Statement]][],
    parsed.Anno[],
    WS,
    Token
]): parsed.BlockStatement {
    const stms1: parsed.Statement[][] = stms.map(x =>
        x[1][0].map((y): parsed.Statement => ({ tag: "AnnoStatement", anno: y })).concat([x[1][1]])
    );
    const stms2: parsed.Statement[] = annos.map((x): parsed.Statement => ({
        tag: "AnnoStatement",
        anno: x
    }));
    const stmsAll: parsed.Statement[] = stms1
        .concat([stms2])
        .reduce((collect, stms) => collect.concat(stms), []);

    return {
        tag: "BlockStatement",
        body: stmsAll,
        range: [l.offset, r.offset + r.text.length]
    };
}

export function BreakStatement([stm, s1, semi]: [Token, any, Token]): ast.BreakStatement {
    return { tag: "BreakStatement", range: [stm.offset, semi.offset + semi.text.length] };
}

export function ContinueStatement([stm, s1, semi]: [Token, any, Token]): ast.ContinueStatement {
    return { tag: "ContinueStatement", range: [stm.offset, semi.offset + semi.text.length] };
}

export function AnnoSet(
    annos: [Token, any, parsed.Anno[], Token] | [Token, any, parsed.Anno[], Token, any, Token]
): parsed.Anno[] {
    const start: Token = annos[0];
    const end: Token = annos[5] ? annos[5] : annos[3];
    if (start.type === "anno_line_start" && start.line !== end.line)
        throw new Error(
            `Single-line annotations cannot be extended onto multiple lines with multiline comments.`
        );
    return annos[2];
}

export function FunctionDeclarationArgs([l, s1, params, r]: [
    Token,
    any,
    null | [ast.Type, any, ast.Identifier, any, [Token, any, ast.Type, any, ast.Identifier, any][]],
    Token
]): parsed.VariableDeclarationOnly[] {
    if (params === null) return [];
    const first: parsed.VariableDeclarationOnly = {
        tag: "VariableDeclaration",
        kind: params[0],
        id: params[2]
    };
    return [first].concat(
        params[4].map((x): parsed.VariableDeclarationOnly => ({
            tag: "VariableDeclaration",
            kind: x[2],
            id: x[4]
        }))
    );
}

export function StructDeclaration([struct, s1, s, s2, semi]: [
    any,
    any,
    ast.Identifier,
    any,
    any
]): ast.StructDeclaration {
    return {
        tag: "StructDeclaration",
        id: s,
        definitions: null
    };
}

export function StructDefinition([struct, s1, s, s2, l, s3, defs, r, s5, semi]: [
    any,
    any,
    ast.Identifier,
    any,
    any,
    any,
    [ast.Type, any, ast.Identifier, any, any, any][],
    any,
    any,
    any
]): parsed.StructDeclaration {
    return {
        tag: "StructDeclaration",
        id: s,
        definitions: defs.map((value): parsed.VariableDeclarationOnly => ({
            tag: "VariableDeclaration",
            id: value[2],
            kind: value[0]
        }))
    };
}

export function TypeDefinition([typedef, s1, tp, s2, id]: [
    any,
    any,
    ast.Type,
    any,
    ast.Identifier
]): parsed.TypeDefinition {
    return {
        tag: "TypeDefinition",
        definition: {
            tag: "VariableDeclaration",
            id: id,
            kind: tp
        }
    };
}

export function FunctionTypeDefinition([typedef, s1, ty, s2, f, s3, args, annos]: [
    any,
    any,
    ast.Type,
    any,
    ast.Identifier,
    any,
    ast.VariableDeclarationOnly[],
    parsed.Anno[]
]): parsed.FunctionTypeDefinition {
    return {
        tag: "FunctionTypeDefinition",
        definition: {
            tag: "FunctionDeclaration",
            returns: ty,
            id: f,
            params: args,
            annos: annos,
            body: null
        }
    };
}

export function FunctionDeclaration([ty, s1, f, s2, args, annos, s3, def]: [
    ast.Type,
    any,
    ast.Identifier,
    any,
    ast.VariableDeclarationOnly[],
    parsed.Anno[],
    any,
    null | parsed.BlockStatement
]): parsed.FunctionDeclaration {
    return {
        tag: "FunctionDeclaration",
        returns: ty,
        id: f,
        params: args,
        annos: annos,
        body: def
    };
}
