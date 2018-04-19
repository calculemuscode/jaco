/**
 * Internal representation: the parsed syntax for C0/C1
 */

import * as ast from "./ast";

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
    | HasTagExpression
    | AssignmentExpression
    | UpdateExpression
    | AssertExpression
    | ErrorExpression;

export interface ArrayMemberExpression extends ast.Syn {
    readonly tag: "ArrayMemberExpression";
    readonly object: Expression;
    readonly index: Expression;
}

export interface StructMemberExpression extends ast.Syn {
    readonly tag: "StructMemberExpression";
    readonly deref: boolean;
    readonly object: Expression;
    readonly field: ast.Identifier;
}

export interface CallExpression extends ast.Syn {
    readonly tag: "CallExpression";
    readonly callee: ast.Identifier;
    readonly arguments: Expression[];
}

export interface IndirectCallExpression extends ast.Syn {
    readonly tag: "IndirectCallExpression";
    readonly callee: Expression;
    readonly arguments: Expression[];
}

export interface CastExpression extends ast.Syn {
    readonly tag: "CastExpression";
    readonly kind: Type;
    readonly argument: Expression;
}

export interface UnaryExpression extends ast.Syn {
    readonly tag: "UnaryExpression";
    readonly operator: "&" | "!" | "~" | "-" | "*";
    readonly argument: Expression;
}

/**
 * Eager binary operations `e+e` and friends
 */
export interface BinaryExpression extends ast.Syn {
    readonly tag: "BinaryExpression";
    readonly operator:
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
    readonly left: Expression;
    readonly right: Expression;
}

export interface LogicalExpression extends ast.Syn {
    readonly tag: "LogicalExpression";
    readonly operator: "||" | "&&";
    readonly left: Expression;
    readonly right: Expression;
}

export interface ConditionalExpression extends ast.Syn {
    readonly tag: "ConditionalExpression";
    readonly test: Expression;
    readonly consequent: Expression;
    readonly alternate: Expression;
}

export interface AllocExpression extends ast.Syn {
    readonly tag: "AllocExpression";
    readonly kind: Type;
}

export interface AllocArrayExpression extends ast.Syn {
    readonly tag: "AllocArrayExpression";
    readonly kind: Type;
    readonly size: Expression;
}

/**
 * `\result`
 */
export interface ResultExpression extends ast.Syn {
    readonly tag: "ResultExpression";
}

/**
 * `\length(e)`
 */
export interface LengthExpression extends ast.Syn {
    readonly tag: "LengthExpression";
    readonly argument: Expression;
}

/**
 * `\hastag(ty,e)`
 */
export interface HasTagExpression extends ast.Syn {
    readonly tag: "HasTagExpression";
    readonly kind: Type;
    readonly argument: Expression;
}

export interface AssignmentExpression extends ast.Syn {
    readonly tag: "AssignmentExpression";
    readonly operator: "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "<<=" | ">>=" | "&=" | "^=" | "|=";
    readonly left: Expression;
    readonly right: Expression;
}

export interface UpdateExpression extends ast.Syn {
    readonly tag: "UpdateExpression";
    readonly operator: "++" | "--";
    readonly argument: Expression;
}

export interface AssertExpression extends ast.Syn {
    readonly tag: "AssertExpression";
    readonly contract: boolean;
    readonly test: Expression;
}

export interface ErrorExpression extends ast.Syn {
    readonly tag: "ErrorExpression";
    readonly argument: Expression;
}

export type Statement =
    | ExpressionStatement
    | VariableDeclaration
    | IfStatement
    | WhileStatement
    | ForStatement
    | ReturnStatement
    | BlockStatement
    | ast.BreakStatement
    | ast.ContinueStatement;

export interface ExpressionStatement extends ast.Syn {
    readonly tag: "ExpressionStatement";
    readonly expression: Expression;
}

export interface VariableDeclaration extends ast.Syn {
    readonly tag: "VariableDeclaration";
    readonly kind: Type;
    readonly id: ast.Identifier;
    readonly init: Expression | null;
}

export interface IfStatement extends ast.Syn {
    readonly tag: "IfStatement";
    readonly test: Expression;
    readonly consequent: Statement;
    readonly alternate?: Statement;
}

export interface WhileStatement extends ast.Syn {
    readonly tag: "WhileStatement";
    readonly invariants: Expression[];
    readonly test: Expression;
    readonly body: Statement;
}

export interface ForStatement extends ast.Syn {
    readonly tag: "ForStatement";
    readonly invariants: Expression[];
    readonly init: Statement | null;
    readonly test: Statement;
    readonly update: Statement | null;
    readonly body: Statement;
}

export interface ReturnStatement extends ast.Syn {
    readonly tag: "ReturnStatement";
    readonly argument: Expression | null;
}

export interface BlockStatement extends ast.Syn {
    readonly tag: "BlockStatement";
    readonly body: Statement[];
}


