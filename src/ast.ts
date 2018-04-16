/**
 * C1 AST
 *
 * Aims to mostly-faithfully capture the the C1 Grammar as described in
 * http://c0.typesafety.net/doc/c0-reference.pdf
 *
 * Exceptions:
 *  - Does not distinguish <sid>, <vid>, <fid>, and <aid> categories. These are used by the parser to
 *    disambiguate syntactic forms (especially the unfortunate <aid> vs. <tid> distinction needed to parse the
 *    statement `x * y;` as a binary expression or variable declaration). Within a full syntax tree
 *    they are unambiguous and can all be represented with Identifier.
 *  - The restrictions that a variable declaration not appear in the update of a ForStatement is expressed
 *    (this is a property of static semantics in the spec, see C0.23, "The step statement in a for loop may
 *    not be a declaration".).
 *  - SimpleStatement does not include variable declarations, which facilitates the above exception.
 *
 *  - The placement restrictions on requires, ensures, loop_invariant, and assert contracts are
 *    expressed. These are properties of static semantics in the spec, see C0.23, "@requires and @ensures can
 *    only annotate functions," etc.
 *
 * Loosely based on Esprima, with the notable and stubborn distinction of using "tag" instead of "type."
 * Esprima Spec: https://esprima.readthedocs.io/en/latest/syntax-tree-format.html
 * Esprima Demo: http://esprima.org/demo/parse.html
 */

export interface Syn {
    readonly tag: string;
    readonly range?: [number, number];
    readonly loc?: SourceLocation;
}

export interface Position {
    readonly line: number;
    readonly column: number;
}

export interface SourceLocation {
    readonly start: Position;
    readonly end: Position;
    readonly source?: string | null;
}

export type Type = null;

export type Expression =
    | Identifier
    | IntLiteral
    | StringLiteral
    | CharLiteral
    | BoolLiteral
    | NullLiteral
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

export interface Identifier extends Syn {
    readonly tag: "Identifier";
    readonly name: string;
}

export interface IntLiteral extends Syn {
    readonly tag: "IntLiteral";
    readonly value: number;
    readonly raw: string;
}

export interface StringLiteral extends Syn {
    readonly tag: "StringLiteral";
    readonly value: string;
    readonly raw: string;
}

export interface CharLiteral extends Syn {
    readonly tag: "CharLiteral";
    readonly value: string;
    readonly raw: string;
}

export interface BoolLiteral extends Syn {
    readonly tag: "BoolLiteral";
    readonly value: boolean;
}

export interface NullLiteral extends Syn {
    readonly tag: "NullLiteral";
}

/**
 * Array access `e[e]`
 */
export interface ArrayMemberExpression extends Syn {
    readonly tag: "ArrayMemberExpression";
    readonly object: Expression;
    readonly index: Expression;
}

/**
 * Struct field access:
 *  - `e.f` (deref === false)
 *  - `e->f` (deref === true)
 */
export interface StructMemberExpression extends Syn {
    readonly tag: "StructMemberExpression";
    readonly deref: boolean;
    readonly object: Expression;
    readonly field: Identifier;
}

/**
 * Regular function calls `f(e1,e2,...,en)`
 */
export interface CallExpression extends Syn {
    readonly tag: "CallExpression";
    readonly callee: Identifier;
    readonly arguments: Expression[];
}

/**
 * Function pointer calls `(*e)(e1,e2,...,en)`
 */
export interface IndirectCallExpression extends Syn {
    readonly tag: "IndirectCallExpression";
    readonly callee: Expression;
    readonly arguments: Expression[];
}

/**
 * Prefix cast operation `(ty)e`.
 */
export interface CastExpression extends Syn {
    readonly tag: "CastExpression";
    readonly kind: Type;
    readonly argument: Expression;
}

/**
 * Prefix unary operations `~e` and friends.
 */
export interface UnaryExpression extends Syn {
    readonly tag: "UnaryExpression";
    readonly operator: "&" | "!" | "~" | "-" | "*";
    readonly argument: Expression;
}

/**
 * Eager binary operations `e+e` and friends
 */
export interface BinaryExpression extends Syn {
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

/**
 * Short-circuiting binary operations `e && e` and `e || e`.
 */
export interface LogicalExpression extends Syn {
    readonly tag: "LogicalExpression";
    readonly operator: "||" | "&&";
    readonly left: Expression;
    readonly right: Expression;
}

/**
 * `e ? e : e`
 */
export interface ConditionalExpression extends Syn {
    readonly tag: "ConditionalExpression";
    readonly test: Expression;
    readonly consequent: Expression;
    readonly alternate: Expression;
}

/**
 * `alloc(ty)`
 */
export interface AllocExpression extends Syn {
    readonly tag: "AllocExpression";
    readonly kind: Type;
}

/**
 * `alloc(ty)`
 */
export interface AllocArrayExpression extends Syn {
    readonly tag: "AllocArrayExpression";
    readonly kind: Type;
    readonly size: Expression;
}

/**
 * `\result`
 */
export interface ResultExpression extends Syn {
    readonly tag: "ResultExpression";
}

/**
 * `\length(e)`
 */
export interface LengthExpression extends Syn {
    readonly tag: "LengthExpression";
    readonly argument: Expression;
}

/**
 * `\hastag(ty,e)`
 */
export interface HasTagExpression extends Syn {
    readonly tag: "HasTagExpression";
    readonly kind: Type;
    readonly argument: Expression;
}

/**
 * LValues are a refinement of Expressions
 */
export type LValue = Identifier | StructMemberLValue | DereferenceLValue | ArrayMemberLValue;

export interface StructMemberLValue extends StructMemberExpression {
    readonly object: LValue;
}

export interface DereferenceLValue extends UnaryExpression {
    readonly operator: "*";
    readonly argument: LValue;
}

export interface ArrayMemberLValue extends ArrayMemberExpression {
    readonly object: LValue;
}

export type SimpleStatement = AssignmentStatement | UpdateStatement | ExpressionStatement;

export type Statement =
    | SimpleStatement
    | VariableDeclaration
    | IfStatement
    | WhileStatement
    | ForStatement
    | ReturnStatement
    | BlockStatement
    | AssertStatement
    | ErrorStatement
    | BreakStatement
    | ContinueStatement;

export interface AssignmentStatement extends Syn {
    readonly tag: "AssignmentStatement";
    readonly operator: "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "<<=" | ">>=" | "&=" | "^=" | "|=";
    readonly left: LValue;
    readonly right: Expression;
}

export interface UpdateStatement extends Syn {
    readonly tag: "UpdateStatement";
    readonly operator: "++" | "--";
    readonly argument: Expression;
}

export interface ExpressionStatement extends Syn {
    readonly tag: "ExpressionStatement";
    readonly expression: Expression;
}

export interface VariableDeclaration extends Syn {
    readonly tag: "VariableDeclaration";
    readonly kind: Type;
    readonly id: Identifier;
    readonly init: Expression | null;
}

export interface IfStatement extends Syn {
    readonly tag: "IfStatement";
    readonly test: Expression;
    readonly consequent: Statement;
    readonly alternate?: Statement;
}

export interface WhileStatement extends Syn {
    readonly tag: "WhileStatement";
    readonly invariants: Expression[];
    readonly test: Expression;
    readonly body: Statement;
}

export interface ForStatement extends Syn {
    readonly tag: "ForStatement";
    readonly invariants: Expression[];
    readonly init: SimpleStatement | VariableDeclaration | null;
    readonly test: Expression;
    readonly update: SimpleStatement | null;
    readonly body: Statement;
}

export interface ReturnStatement extends Syn {
    readonly tag: "ReturnStatement";
    readonly argument: Expression | null;
}

export interface BlockStatement extends Syn {
    readonly tag: "BlockStatement";
    readonly body: Statement[];
}

export interface AssertStatement extends Syn {
    readonly tag: "AssertStatement";
    readonly contract: boolean;
    readonly test: Expression;
}

export interface ErrorStatement extends Syn {
    readonly tag: "ErrorStatement";
    readonly argument: Expression;
}

export interface BreakStatement extends Syn {
    readonly tag: "BreakStatement";
}

export interface ContinueStatement extends Syn {
    readonly tag: "ContinueStatement";
}
