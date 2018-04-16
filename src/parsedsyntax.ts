/**
 * Internal representation: the parsed syntax for C0/C1
 */

import { Lang } from "./lang";
import * as ast from "./ast";
import { impossible } from "@calculemus/impossible";

export type Type = ast.Identifier;

export type Expression =
    | ast.Identifier
    | ast.IntLiteral
    | ast.StringLiteral
    | ast.CharLiteral
    | ast.BoolLiteral
    | ast.NullLiteral
    | ArrayMemberExpression
    | StructMemberExpression
    | CallExpression
    | IndirectCallExpression
    | CastExpression
    | UnaryExpression
    | BinaryExpression
    | LogicalExpression
    | ConditionalExpression
    | AllocExpression
    | AllocArrayExpression
    | ResultExpression
    | LengthExpression
    | HasTagExpression;

export interface ArrayMemberExpression extends ast.Syn {
    tag: "ArrayMemberExpression";
    object: Expression;
    index: Expression;
}

export interface StructMemberExpression extends ast.Syn {
    tag: "StructMemberExpression";
    deref: boolean;
    object: Expression;
    field: ast.Identifier;
}

export interface CallExpression extends ast.Syn {
    tag: "CallExpression";
    callee: ast.Identifier;
    arguments: Expression[];
}

export interface IndirectCallExpression extends ast.Syn {
    tag: "IndirectCallExpression";
    callee: Expression;
    arguments: Expression[];
}

export interface CastExpression extends ast.Syn {
    tag: "CastExpression";
    kind: Type;
    argument: Expression;
}

export interface UnaryExpression extends ast.Syn {
    tag: "UnaryExpression";
    operator: "&" | "!" | "~" | "-" | "*";
    argument: Expression;
}

/**
 * Eager binary operations `e+e` and friends
 */
export interface BinaryExpression extends ast.Syn {
    tag: "BinaryExpression";
    operator:
        | "*"
        | "/"
        | "%"
        | "+"
        | "-"
        | "<<"
        | ">>"
        | "<"
        | "<="
        | ">="
        | ">"
        | "=="
        | "!="
        | "&"
        | "^"
        | "|";
    left: Expression;
    right: Expression;
}

export interface LogicalExpression extends ast.Syn {
    tag: "LogicalExpression";
    operator: "||" | "&&";
    left: Expression;
    right: Expression;
}

export interface ConditionalExpression extends ast.Syn {
    tag: "ConditionalExpression";
    test: Expression;
    consequent: Expression;
    alternate: Expression;
}

export interface AllocExpression extends ast.Syn {
    tag: "AllocExpression";
    kind: Type;
}

export interface AllocArrayExpression extends ast.Syn {
    tag: "AllocArrayExpression";
    kind: Type;
    size: Expression;
}

/**
 * `\result`
 */
export interface ResultExpression extends ast.Syn {
    tag: "ResultExpression";
}

/**
 * `\length(e)`
 */
export interface LengthExpression extends ast.Syn {
    tag: "LengthExpression";
    argument: Expression;
}

/**
 * `\hastag(ty,e)`
 */
export interface HasTagExpression extends ast.Syn {
    tag: "HasTagExpression";
    kind: Type;
    argument: Expression;
}

export type Statement = ForStatement | ExpressionStatement;
/*
export type Statement = SimpleStatement | VariableDeclaration | ConditionalStatement | WhileStatement | ForStatement | ReturnStatement | BlockStatement | AssertStatement | ErrorStatement;
*/

export interface AssignmentExpression extends ast.Syn {
    tag: "AssignExpression";
    operator: "=";
    left: Expression;
    right: Expression;
}

export interface UpdateExpression extends ast.Syn {
    tag: "UpdateExpression";
    operator: "++" | "--";
    argument: Expression;
}

export interface ExpressionStatement extends ast.Syn {
    tag: "ExpressionStatement";
    expression: Expression;
}

export interface VariableDeclaration extends ast.Syn {
    tag: "VariableDeclaration";
    kind: Type;
    id: ast.Identifier;
    init: Expression | null;
}

export interface ForStatement extends ast.Syn {
    tag: "ForStatement";
    invariants: Expression[];
    init: ExpressionStatement | VariableDeclaration | null;
    test: Expression;
    update: ExpressionStatement | null;
    body: Statement;
}

export function restrictType(lang: Lang, syn: Type): ast.Type {
    return null;
}

export function restrictExpression(lang: Lang, syn: Expression): ast.Expression {
    switch (syn.tag) {
        case "StringLiteral":
        case "CharLiteral":
            if (lang === "L1" || lang === "L2" || lang === "L3" || lang === "L4")
                throw new Error(`String and char literals are not a part of ${lang}`);
        case "BoolLiteral":
            if (lang === "L1") throw new Error(`Boolean literals 'true' and 'false' are not part of ${lang}`);
        case "NullLiteral":
            if (lang === "L1" || lang === "L2" || lang === "L3")
                throw new Error(`'NULL' is not a part of ${lang}`);
        case "Identifier":
        case "IntLiteral":
            return syn;
        case "ArrayMemberExpression": {
            if (lang === "L1" || lang === "L2" || lang === "L3")
                throw new Error(`Array derefernece is not a part of ${lang}`);
            return {
                tag: "ArrayMemberExpression",
                object: restrictExpression(lang, syn.object),
                index: restrictExpression(lang, syn.index)
            };
        }
        case "StructMemberExpression": {
            if (lang === "L1" || lang === "L2" || lang === "L3")
                throw new Error(`Struct dereference is not a part of ${lang}`);
            return {
                tag: "StructMemberExpression",
                deref: syn.deref,
                object: restrictExpression(lang, syn.object),
                field: syn.field
            };
        }
        case "CallExpression": {
            if (lang === "L1" || lang === "L2") throw new Error(`Functions are not a part of ${lang}`);
            return {
                tag: "CallExpression",
                callee: syn.callee,
                arguments: syn.arguments.map(x => restrictExpression(lang, x))
            };
        }
        case "IndirectCallExpression": {
            if (lang !== "C1") throw new Error(`Calls from function pointers not a part of ${lang}`);
            return {
                tag: "IndirectCallExpression",
                callee: restrictExpression(lang, syn.callee),
                arguments: syn.arguments.map(x => restrictExpression(lang, x))
            };
        }
        case "CastExpression": {
            if (lang !== "C1") throw new Error(`Casts not a part of ${lang}`);
            return {
                tag: "CastExpression",
                kind: restrictType(lang, syn.kind),
                argument: restrictExpression(lang, syn.argument)
            };
        }
        case "UnaryExpression": {
            if (syn.operator === "&" && lang !== "C1") throw new Error(`Address-of not a part of ${lang}`);
            if (syn.operator === "!" && lang === "L1")
                throw new Error(`Boolean negation not a part of ${lang}`);
            return {
                tag: "UnaryExpression",
                operator: syn.operator,
                argument: restrictExpression(lang, syn.argument)
            };
        }
        case "BinaryExpression": {
            if (lang === "L1") {
                switch (syn.operator) {
                    case "*":
                    case "/":
                    case "%":
                    case "+":
                    case "-":
                        break;
                    default:
                        throw new Error(`Operator ${syn.operator} not a part of ${lang}`);
                }
            }
            return {
                tag: "BinaryExpression",
                operator: syn.operator,
                left: restrictExpression(lang, syn.left),
                right: restrictExpression(lang, syn.right)
            };
        }
        case "LogicalExpression": {
            if (lang === "L1") throw new Error(`Logical operators not a part of ${lang}`);
            return {
                tag: "LogicalExpression",
                operator: syn.operator,
                left: restrictExpression(lang, syn.left),
                right: restrictExpression(lang, syn.right)
            };
        }
        case "ConditionalExpression": {
            if (lang === "L1") throw new Error(`Conditional expression is not a part of ${lang}`);
            return {
                tag: "ConditionalExpression",
                test: restrictExpression(lang, syn.test),
                consequent: restrictExpression(lang, syn.consequent),
                alternate: restrictExpression(lang, syn.alternate)
            };
        }
        case "AllocExpression": {
            if (lang === "L1" || lang === "L2" || lang === "L3")
                throw new Error(`Allocation not a part of ${lang}`);
            return {
                tag: "AllocExpression",
                kind: restrictType(lang, syn.kind)
            };
        }
        case "AllocArrayExpression": {
            if (lang === "L1" || lang === "L2" || lang === "L3")
                throw new Error(`Allocation not a part of ${lang}`);
            return {
                tag: "AllocArrayExpression",
                kind: restrictType(lang, syn.kind),
                size: restrictExpression(lang, syn.size)
            };
        }
        case "ResultExpression": {
            if (lang === "L1" || lang === "L2" || lang === "L3" || lang === "L4")
                throw new Error(`Contracts not a part of ${lang}`);
            return {
                tag: "ResultExpression"
            };
        }
        case "LengthExpression": {
            if (lang === "L1" || lang === "L2" || lang === "L3" || lang === "L4")
                throw new Error(`Contracts not a part of ${lang}`);
            return {
                tag: "LengthExpression",
                argument: restrictExpression(lang, syn.argument)
            };
        }
        case "HasTagExpression": {
            if (lang !== "C1") throw new Error(`Tag contracts not a part of ${lang}`);
            return {
                tag: "HasTagExpression",
                kind: restrictType(lang, syn.kind),
                argument: restrictExpression(lang, syn.argument)
            };
        }
        default: return impossible(syn);
    }
}
