import { Token } from "moo";
import * as ast from "./ast";
import * as parsed from "./parsedsyntax";

export function Identifier([{ value, text, offset, lineBreaks, line, col }]: Token[]): ast.Identifier {
    return {
        tag: "Identifier",
        name: text
    };
}

export function IntLiteral([{ value, text, offset, lineBreaks, line, col }]: Token[]): ast.IntLiteral {
    return {
        tag: "IntLiteral",
        value: 0,
        raw: text
    };
}

export function CharLiteral([tokens]: [[Token, [Token], Token]]): ast.CharLiteral {
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
            tag: "CharLiteral",
            value: char.value,
            raw: `'${char.value}'`
        };
    } else if (char["type"] === "special_character") {
        if (!char.value.match(/\\[ntvbrfa\\'"0]/)) {
            throw new Error("Invalid character escape sequence");
        }
        return {
            tag: "CharLiteral",
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

export function ArrayMemberExpression([object, s1, l, s2, index, s3, r]: [parsed.Expression, any, Token, any, parsed.Expression, any, Token]): parsed.ArrayMemberExpression {
    return {
        tag: "ArrayMemberExpression",
        object: object,
        index: index
    }
}

export type Arguments = [Token, any, null | [parsed.Expression, any, [Token, any, parsed.Expression][]],Token];
export function Arguments([l, s1, args, r]: Arguments): parsed.Expression[] {
    if (args === null) return [];
    return [args[0]].concat(args[2].map(x => x[2]));
}

export function StructMemberExpression([object, s1, deref, s2, field]: [parsed.Expression, any, [Token, Token] | Token, any, ast.Identifier]): parsed.StructMemberExpression {
    return {
        tag: "StructMemberExpression",
        deref: deref instanceof Array, // ["-", ">"] vs. "."
        object: object,
        field: field
    }
}

export function CallExpression([f, ws, args]: [ast.Identifier, any, Arguments]): parsed.CallExpression {
    return {
        tag: "CallExpression",
        callee: f,
        arguments: Arguments(args)
    }
}

export function IndirectCallExpression([l, s1, f, s2, r, s3, args]: [Token, any, parsed.Expression, any, Token, any, Arguments]): parsed.IndirectCallExpression {
    return {
        tag: "IndirectCallExpression",
        callee: f,
        arguments: Arguments(args)
    }
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

export function ConditionalExpression([test, s1, op1, s2, consequent, s3, op2, s4, alternate]: [parsed.Expression, any, any, any, parsed.Expression, any, any, any, parsed.Expression]): parsed.ConditionalExpression {
    return {
        tag: "ConditionalExpression",
        test: test,
        consequent: consequent,
        alternate: alternate
    }
}

export function AllocExpression([alloc, s1, l, s2, typ, s3, r]: [Token, any, Token, any, parsed.Type, any, Token]): parsed.AllocExpression {
    return {
        tag: "AllocExpression",
        kind: typ
    }
}

export function AllocArrayExpression([alloc, s1, l, s2, typ, s3, c, s4, size, sp, r]: [Token, any, Token, any, parsed.Type, any, Token, any, parsed.Expression, any, Token]): parsed.AllocArrayExpression {
    return {
        tag: "AllocArrayExpression",
        kind: typ,
        size: size
    }
}

export function ResultExpression([b, res]: [Token, Token]): parsed.ResultExpression {
    return {
        tag: "ResultExpression"
    }
}

export function LengthExpression([b, length, s1, l, s2, argument, s3, r]: [Token, Token, any, Token, any, parsed.Expression, any, Token]): parsed.LengthExpression {
    return {
        tag: "LengthExpression",
        argument: argument
    }
}

export function HasTagExpression([b, hastag, s1, l, s2, typ, s3, c, s4, argument, s5, r]: [Token, Token, any, Token, any, parsed.Type, any, Token, any, parsed.Expression, any, Token]): parsed.HasTagExpression {
    return {
        tag: "HasTagExpression",
        kind: typ,
        argument: argument
    }
}

export function UpdateExpression([argument, s1, op1, op2]: [parsed.Expression, any, Token, Token]): parsed.UpdateExpression {
    return {
        tag: "UpdateExpression",
        argument: argument,
        operator: op1.value === "+" ? "++" : "--"
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
