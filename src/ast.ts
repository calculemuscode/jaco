/**
 * C1 AST
 *
 * Aims to mostly-faithfully capture the the C1 Grammar as described in
 * http://c0.typesafety.net/doc/c0-reference.pdf
 *
 * Exceptions:
 *  - Does not distinguish <sid>, <vid>, <fid>, and <aid> categories. These are used by the parser to
 *    disambiguate syntactic forms (especially the unfortunate <aid> vs. <tid> distinction needed to parse the
 *    statement `x * y;` as a binary expression or variable declaration). However, within a full syntax tree
 *    they are unambiguous and can all be represented with Identifier.
 *  - The restrictions that a variable declaration not appear in the update of a ForStatement is expressed
 *    (this is a property of static semantics in the spec, see C0.23, "The step statement in a for loop may
 *    not be a declaration".).
 * - SimpleStatement does not include variable declarations, which facilitates the above exception.
 * - The placement restrictions on requires, ensures, loop_invariant, and assert contracts are
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
    loc?: SourceLocation;
}

export interface Position {
    line: number;
    column: number;
}

export interface SourceLocation {
    start: Position;
    end: Position;
    source?: string | null;
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
    tag: "Identifier";
    name: string;
}

export interface IntLiteral extends Syn {
    tag: "IntLiteralExpression";
    value: number;
    raw: string;
}

export interface StringLiteral extends Syn {
    tag: "StringLiteralExpression";
    value: string;
    raw: string;
}

export interface CharLiteral extends Syn {
    tag: "CharLiteralExpression";
    value: string;
    raw: string;
}

export interface BoolLiteral extends Syn {
    tag: "BoolLiteralExpression";
    value: boolean;
}

export interface NullLiteral extends Syn {
    tag: "NullLiteralExpression";
}

/**
 * Array access `e[e]`
 */
export interface ArrayMemberExpression extends Syn {
    tag: "ArrayMemberExpression";
    object: Expression;
    index: Expression;
}

/**
 * Struct field access:
 *  - `e.f` (deref === false)
 *  - `e->f` (deref === true)
 */
export interface StructMemberExpression extends Syn {
    tag: "StructMemberExpression";
    deref: boolean;
    object: Expression;
    field: Identifier;
}

/**
 * Regular function calls `f(e1,e2,...,en)`
 */
export interface CallExpression extends Syn {
    tag: "CallExpression";
    callee: Identifier;
    arguments: Expression[];
}

/**
 * Function pointer calls `(*e)(e1,e2,...,en)`
 */
export interface IndirectCallExpression extends Syn {
    tag: "IndirectCallExpression";
    callee: Expression;
    arguments: Expression[];
}

/**
 * Prefix unary operations `~e` and friends.
 */
export interface CastExpression extends Syn {
    tag: "CastExpression";
    kind: Type;
    argument: Expression;
}

/**
 * Prefix unary operations `~e` and friends.
 */
export interface UnaryExpression extends Syn {
    tag: "UnaryExpression";
    operator: "&" | "!" | "~" | "-" | "*";
    argument: Expression;
}

/**
 * Eager binary operations `e+e` and friends
 */
export interface BinaryExpression extends Syn {
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

/**
 * Short-circuiting binary operations `e && e` and `e || e`.
 */
export interface LogicalExpression extends Syn {
    tag: "LogicalExpression";
    operator: "||" | "&&";
    left: Expression;
    right: Expression;
}

/**
 * `e ? e : e`
 */
export interface ConditionalExpression extends Syn {
    tag: "ConditionalExpression";
    test: Expression;
    consequent: Expression;
    alternate: Expression;
}

/**
 * `alloc(ty)`
 */
export interface AllocExpression extends Syn {
    tag: "AllocExpression";
    kind: Type;
}

/**
 * `alloc(ty)`
 */
export interface AllocArrayExpression extends Syn {
    tag: "AllocArrayExpression";
    kind: Type;
    size: Expression;
}

/**
 * `\result`
 */
export interface ResultExpression extends Syn {
    tag: "ResultExpression";
}

/**
 * `\length(e)`
 */
export interface LengthExpression extends Syn {
    tag: "LengthExpression";
    argument: Expression;
}

/**
 * `\hastag(ty,e)`
 */
export interface HasTagExpression extends Syn {
    tag: "HasTagExpression";
    kind: Type;
    argument: Expression;
}

/**
 * LValues are a refinement of Expressions
 */
export type LValue = Identifier | ArrayMemberLValue | StructMemberLValue | DereferenceLValue;

export interface ArrayMemberLValue extends ArrayMemberExpression {
    object: LValue;
}

export interface StructMemberLValue extends StructMemberExpression {
    object: LValue;
}

export interface DereferenceLValue extends UnaryExpression {
    operator: "*";
    argument: LValue;
}

export type SimpleStatement = AssignmentStatement | UpdateStatement | ExpressionStatement;
export type Statement = ForStatement;
/*
export type Statement = SimpleStatement | VariableDeclaration | ConditionalStatement | WhileStatement | ForStatement | ReturnStatement | BlockStatement | AssertStatement | ErrorStatement;
*/

/** Intermediate form used in parsing */
export interface AssignmentExpression extends Syn {
    tag: "AssignmentExpression";
    operator: "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "&=" | "^=" | "|=" | "<<=" | ">>=";
    left: Expression;
    right: Expression;
}

export interface AssignmentStatement extends Syn {
    tag: "AssignmentStatement";
    operator: "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "&=" | "^=" | "|=" | "<<=" | ">>=";
    left: LValue;
    right: Expression;
}

export interface UpdateStatement extends Syn {
    tag: "UpdateStatement";
    operator: "++" | "--";
    argument: Expression;
}

export interface ExpressionStatement extends Syn {
    tag: "ExpressionStatement";
    expression: Expression;
}

export interface VariableDeclaration extends Syn {
    tag: "VariableDeclaration";
    kind: Type;
    id: Identifier;
    init: Expression | null;
}

export interface ForStatement extends Syn {
    tag: "ForStatement";
    invariants: Expression[];
    init: SimpleStatement | VariableDeclaration | null;
    test: Expression;
    update: SimpleStatement | null;
    body: Statement;
}
