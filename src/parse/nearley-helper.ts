/**
 * This is where the bodies (of ugly non-type-safe code) are buried.
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
import * as syn from "./parsedsyntax";

// This is incorrect, but Typescript doesn't check anyway
// If whitespace gets captured or analyzed in the future this needs revisiting
export type WS = { contents: (Token | WS)[] };

export function Identifier([tok]: [Token]): syn.Identifier {
    return {
        tag: "Identifier",
        name: tok.text,
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function IntType([tok]: [Token]): syn.IntType {
    return {
        tag: "IntType",
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function BoolType([tok]: [Token]): syn.BoolType {
    return {
        tag: "BoolType",
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function StringType([tok]: [Token]): syn.StringType {
    return {
        tag: "StringType",
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function CharType([tok]: [Token]): syn.CharType {
    return {
        tag: "CharType",
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function VoidType([tok]: [Token]): syn.VoidType {
    return {
        tag: "VoidType",
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function PointerType([tp, s, tok]: [syn.Type, WS, Token]): syn.PointerType {
    return {
        tag: "PointerType",
        argument: tp,
        range: [tp.range[0], tok.offset + tok.text.length]
    };
}

export function ArrayType([tp, s1, l, s2, r]: [syn.Type, WS, Token, WS, Token]): syn.ArrayType {
    return {
        tag: "ArrayType",
        argument: tp,
        range: [tp.range[0], r.offset + r.text.length]
    };
}

export function StructType([str, s, id]: [Token, WS, syn.Identifier]): syn.StructType {
    return {
        tag: "StructType",
        id: id,
        range: [str.offset, id.range[1]]
    };
}

export function IntLiteral([tok]: Token[]): syn.IntLiteral {
    return {
        tag: "IntLiteral",
        raw: tok.text,
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function StringLiteral([[start, toks, end]]: [[Token, [Token][], Token]]): syn.StringLiteral {
    return {
        tag: "StringLiteral",
        raw: toks.map(x => x[0].value),
        range: [start.offset, end.offset + end.text.length]
    };
}

export function CharLiteral([[start, [tok], end]]: [[Token, [Token], Token]]): syn.CharLiteral {
    return {
        tag: "CharLiteral",
        raw: tok.value,
        range: [start.offset, end.offset + end.text.length]
    };
}

export function BoolLiteral([tok]: [Token]): syn.BoolLiteral {
    return {
        tag: "BoolLiteral",
        value: tok.value === "true",
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function NullLiteral([tok]: [Token]): syn.NullLiteral {
    return {
        tag: "NullLiteral",
        range: [tok.offset, tok.offset + tok.text.length]
    };
}

export function ArrayMemberExpression([object, s1, l, s2, index, s3, r]: [
    syn.Expression,
    WS,
    Token,
    WS,
    syn.Expression,
    WS,
    Token
]): syn.ArrayMemberExpression {
    return {
        tag: "ArrayMemberExpression",
        object: object,
        index: index,
        range: [object.range[0], r.offset + r.text.length]
    };
}

export function StructMemberExpression([object, s1, deref, s2, field]: [
    syn.Expression,
    WS,
    [Token, Token] | Token,
    WS,
    syn.Identifier
]): syn.StructMemberExpression {
    return {
        tag: "StructMemberExpression",
        deref: deref instanceof Array, // ["-", ">"] vs. "."
        object: object,
        field: field,
        range: [object.range[0], field.range[1]]
    };
}

/**
 * Helper type and helper function for function arguments
 */
export type Arguments = [WS, null | [syn.Expression, [WS, Token, WS, syn.Expression][], WS]];

export function Arguments([s1, args]: Arguments): syn.Expression[] {
    if (args === null) return [];
    return [args[0]].concat(args[1].map(x => x[3]));
}

export function CallExpression([f, ws, l, args, r]: [
    syn.Identifier,
    WS,
    Token,
    Arguments,
    Token
]): syn.CallExpression {
    return {
        tag: "CallExpression",
        callee: f,
        arguments: Arguments(args),
        range: [f.range[0], r.offset + r.text.length]
    };
}

export function IndirectCallExpression([l1, s1, s, s2, f, s3, r1, s4, l2, args, r2]: [
    Token,
    WS,
    Token,
    WS,
    syn.Expression,
    WS,
    Token,
    WS,
    Token,
    Arguments,
    Token
]): syn.IndirectCallExpression {
    return {
        tag: "IndirectCallExpression",
        callee: f,
        arguments: Arguments(args),
        range: [l1.offset, r2.offset + r2.text.length]
    };
}

export function UnaryExpression([operator, s, argument]: [
    [Token] | [Token, WS, syn.Type, WS, Token],
    Token,
    syn.Expression
]): syn.UnaryExpression | syn.CastExpression {
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
                    range: [oper.offset, argument.range[1]]
                };

            default:
                throw new Error(operator[0].value);
        }
    } else {
        return {
            tag: "CastExpression",
            kind: operator[2],
            argument: argument,
            range: [operator[0].offset, argument.range[1]]
        };
    }
}

export function BinaryExpression([left, s1, opertoks, s2, right]: [
    syn.Expression,
    WS,
    Token[],
    WS,
    syn.Expression
]): syn.BinaryExpression | syn.LogicalExpression | syn.AssignmentExpression {
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
                range: [left.range[0], right.range[1]]
            };
        case "&&":
        case "||":
            return {
                tag: "LogicalExpression",
                operator: operator,
                left: left,
                right: right,
                range: [left.range[0], right.range[1]]
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
                range: [left.range[0], right.range[1]]
            };

        default:
            throw new Error(operator);
    }
}

export function ConditionalExpression([test, s1, op1, s2, consequent, s3, op2, s4, alternate]: [
    syn.Expression,
    WS,
    Token,
    WS,
    syn.Expression,
    WS,
    Token,
    WS,
    syn.Expression
]): syn.ConditionalExpression {
    return {
        tag: "ConditionalExpression",
        test: test,
        consequent: consequent,
        alternate: alternate,
        range: [test.range[0], alternate.range[1]]
    };
}

export function AllocExpression([alloc, s1, l, s2, typ, s3, r]: [
    Token,
    WS,
    Token,
    WS,
    syn.Type,
    WS,
    Token
]): syn.AllocExpression {
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
    syn.Type,
    WS,
    Token,
    WS,
    syn.Expression,
    WS,
    Token
]): syn.AllocArrayExpression {
    return {
        tag: "AllocArrayExpression",
        kind: typ,
        size: size,
        range: [alloc.offset, r.offset + r.text.length]
    };
}

export function ResultExpression([b, res]: [Token, Token]): syn.ResultExpression {
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
    syn.Expression,
    WS,
    Token
]): syn.LengthExpression {
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
    syn.Type,
    WS,
    Token,
    WS,
    syn.Expression,
    WS,
    Token
]): syn.HasTagExpression {
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
    syn.Expression,
    WS,
    [Token]
]): syn.UpdateExpression {
    return {
        tag: "UpdateExpression",
        argument: argument,
        operator: op[0].value === "++" ? "++" : "--",
        range: [argument.range[0], op[0].offset + op[0].text.length]
    };
}

export function AssertExpression([assert, s1, l, s2, test, s3, r]: [
    Token,
    WS,
    Token,
    WS,
    syn.Expression,
    WS,
    Token
]): syn.AssertExpression {
    return {
        tag: "AssertExpression",
        test: test,
        range: [assert.offset, r.offset + r.text.length]
    };
}

export function ErrorExpression([error, s1, l, s2, argument, s3, r]: [
    Token,
    WS,
    Token,
    WS,
    syn.Expression,
    WS,
    Token
]): syn.ErrorExpression {
    return {
        tag: "ErrorExpression",
        argument: argument,
        range: [error.offset, r.offset + r.text.length]
    };
}

export type SimpleParsed =
    | syn.Expression
    | [syn.Type, WS, syn.Identifier, null | [WS, Token, WS, syn.Expression]];
export function SimpleStatement([stm, s, semi]: [SimpleParsed, WS, Token]):
    | syn.VariableDeclaration
    | syn.ExpressionStatement {
    if (stm instanceof Array) {
        const init = stm[3];
        return {
            tag: "VariableDeclaration",
            kind: stm[0],
            id: stm[2],
            init: init === null ? null : init[3],
            range: [stm[0].range[0], semi.offset + semi.text.length]
        };
    } else {
        return {
            tag: "ExpressionStatement",
            expression: stm,
            range: [stm.range[0], semi.offset + semi.text.length]
        };
    }
}

// Helper types for dangling-if-handling
export type AnnosAndStm = [syn.AnnoStatement[], syn.Statement];
export type Wrapper =
    | { tag: "while"; offset: number; test: syn.Expression }
    | {
          tag: "for";
          offset: number;
          init: null | syn.ExpressionStatement | syn.VariableDeclaration;
          test: syn.Expression;
          update: null | syn.Expression;
      }
    | { tag: "ifelse"; offset: number; test: syn.Expression; consequent: AnnosAndStm };

export function IfElse([tIF, s1, l, s2, test, s3, r, s4, stm, s5, tELSE, s6]: [
    Token,
    WS,
    Token,
    WS,
    syn.Expression,
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
    syn.Expression,
    WS,
    Token,
    null | [WS, syn.Expression],
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
    syn.Expression,
    WS,
    Token,
    WS
]): Wrapper {
    return { tag: "while", test: test, offset: tWHILE.offset };
}

export function Statement([wrappers, annos, stm]: [
    [syn.AnnoStatement[], Wrapper][],
    syn.AnnoStatement[],
    [syn.Statement]
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
                            range: [wrap.offset, stm[1].range[1]]
                        }
                    ];
                case "while":
                    return [
                        newannos,
                        {
                            tag: "WhileStatement",
                            test: wrap.test,
                            body: stm,
                            range: [wrap.offset, stm[1].range[1]]
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
                            range: [wrap.offset, stm[1].range[1]]
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
    syn.Expression,
    WS,
    Token,
    WS,
    AnnosAndStm
]): syn.IfStatement {
    return {
        tag: "IfStatement",
        test: test,
        consequent: consequent,
        range: [tIF.offset, consequent[1].range[1]]
    };
}

export function ReturnStatement([r, argument, s1, semi]: [
    Token,
    null | [WS, syn.Expression],
    WS,
    Token
]): syn.ReturnStatement {
    return {
        tag: "ReturnStatement",
        argument: argument === null ? null : argument[1],
        range: [r.offset, semi.offset + semi.text.length]
    };
}

export function BlockStatement([l, stms, annos, s, r]: [
    Token,
    [WS, [syn.AnnoStatement[], syn.Statement]][],
    syn.AnnoStatement[],
    WS,
    Token
]): syn.BlockStatement {
    const stms1: syn.Statement[][] = stms.map(x =>
        x[1][0].map<syn.Statement>(x => x).concat([x[1][1]])
    );
    const stmsAll: syn.Statement[] = stms1
        .concat([annos])
        .reduce((collect, stms) => collect.concat(stms), []);

    return {
        tag: "BlockStatement",
        body: stmsAll,
        range: [l.offset, r.offset + r.text.length]
    };
}

export function BreakStatement([stm, s1, semi]: [Token, WS, Token]): syn.BreakStatement {
    return { tag: "BreakStatement", range: [stm.offset, semi.offset + semi.text.length] };
}

export function ContinueStatement([stm, s1, semi]: [Token, WS, Token]): syn.ContinueStatement {
    return { tag: "ContinueStatement", range: [stm.offset, semi.offset + semi.text.length] };
}

export function Anno([anno, s1, test, s2, semi, s3]: [[Token], WS, syn.Expression, WS, Token, WS]): syn.AnnoStatement {
    const annotxt = anno[0].text;
    switch (annotxt) {
        case "assert":
        case "loop_invariant":
        case "requires":
        case "ensures":
        return {
            tag: "AnnoStatement",
            anno: annotxt,
            test: test,
            range: [anno[0].offset, semi.offset + semi.text.length]
        }
        default:
        throw new Error(`Unknown annotation @${annotxt}`)
        }
}

export function AnnoSet(
    annos: [Token, WS, syn.AnnoStatement[], Token] | [Token, WS, syn.AnnoStatement[], Token, any, Token]
): syn.AnnoStatement[] {
    const start: Token = annos[0];
    const end: Token = annos[5] ? annos[5] : annos[3];
    if (start.type === "anno_line_start" && start.line !== end.line)
    // XXX ERROR IN FILE
        throw new Error(
            `Single-line annotations cannot be extended onto multiple lines with multiline comments.`
        );
    return annos[2];
}

export function FunctionDeclarationArgs([s1, params]: [
    WS,
    null | [syn.Type, WS, syn.Identifier, WS, [Token, WS, syn.Type, WS, syn.Identifier, WS][]]
]): syn.VariableDeclarationOnly[] {
    if (params === null) return [];
    const first: syn.VariableDeclarationOnly = {
        tag: "VariableDeclaration",
        kind: params[0],
        id: params[2],
        range: [params[0].range[0], params[2].range[1]]
    };
    return [first].concat(
        params[4].map((x): syn.VariableDeclarationOnly => ({
            tag: "VariableDeclaration",
            kind: x[2],
            id: x[4],
            range: [x[2].range[0], x[4].range[1]]
        }))
    );
}

export function StructDeclaration([struct, s1, s, s2, semi]: [
    Token,
    WS,
    syn.Identifier,
    WS,
    Token
]): syn.StructDeclaration {
    return {
        tag: "StructDeclaration",
        id: s,
        definitions: null,
        range: [struct.offset, semi.offset + semi.text.length]
    };
}

export function StructDefinition([struct, s1, s, s2, l, s3, defs, r, s5, semi]: [
    Token,
    WS,
    syn.Identifier,
    WS,
    Token,
    WS,
    [syn.Type, WS, syn.Identifier, WS, Token, WS][],
    Token,
    WS,
    Token
]): syn.StructDeclaration {
    return {
        tag: "StructDeclaration",
        id: s,
        definitions: defs.map((value): syn.VariableDeclarationOnly => ({
            tag: "VariableDeclaration",
            id: value[2],
            kind: value[0],
            range: [value[0].range[0], value[4].offset + value[4].text.length]
        })),
        range: [struct.offset, semi.offset + semi.text.length]
    };
}

export function TypeDefinition([typedef, s1, tp, s2, id]: [
    Token,
    WS,
    syn.Type,
    WS,
    syn.Identifier
]): syn.TypeDefinition {
    return {
        tag: "TypeDefinition",
        definition: {
            tag: "VariableDeclaration",
            id: id,
            kind: tp,
            range: [tp.range[0], id.range[1]]
        },
        range: [typedef.offset, id.range[1]]
    };
}

export function FunctionTypeDefinition([typedef, s1, ty, s2, f, s3, l, args, r, annos]: [
    Token,
    WS,
    syn.Type,
    WS,
    syn.Identifier,
    WS,
    Token,
    syn.VariableDeclarationOnly[],
    Token,
    syn.AnnoStatement[]
]): syn.FunctionTypeDefinition {
    const right = annos.length === 0 ? r.offset + r.text.length : annos[annos.length-1].range[1];
    return {
        tag: "FunctionTypeDefinition",
        definition: {
            tag: "FunctionDeclaration",
            returns: ty,
            id: f,
            params: args,
            annos: annos,
            body: null,
            range: [ty.range[0], right]
        },
        range: [typedef.offset, right]
    };
}

export function FunctionDeclaration([ty, s1, f, s2, l, args, r, annos, s3, def]: [
    syn.Type,
    WS,
    syn.Identifier,
    WS,
    Token,
    syn.VariableDeclarationOnly[],
    Token,
    syn.AnnoStatement[],
    WS,
    null | syn.BlockStatement
]): syn.FunctionDeclaration {
    const right = def !== null ? def.range[1] : annos.length === 0 ? r.offset + r.text.length : annos[annos.length-1].range[1];
    return {
        tag: "FunctionDeclaration",
        returns: ty,
        id: f,
        params: args,
        annos: annos,
        body: def,
        range: [ty.range[0], right]
    };
}
