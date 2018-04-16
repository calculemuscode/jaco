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
    | HasTagExpression
    | AssignmentExpression
    | UpdateExpression;

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

export type Statement =
    | ExpressionStatement
    | VariableDeclaration
    | IfStatement
    | WhileStatement
    | ForStatement
    | ReturnStatement
    | BlockStatement
    | AssertStatement
    | ErrorStatement
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

export interface AssertStatement extends ast.Syn {
    readonly tag: "AssertStatement";
    readonly contract: boolean;
    readonly test: Expression;
}

export interface ErrorStatement extends ast.Syn {
    readonly tag: "ErrorStatement";
    readonly argument: Expression;
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
                throw new Error(`Array access is not a part of ${lang}`);
            return {
                tag: "ArrayMemberExpression",
                object: restrictExpression(lang, syn.object),
                index: restrictExpression(lang, syn.index)
            };
        }
        case "StructMemberExpression": {
            if (lang === "L1" || lang === "L2" || lang === "L3")
                throw new Error(`Struct access is not a part of ${lang}`);
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
            if (syn.operator === "*" && (lang === "L1" || lang === "L2" || lang === "L3"))
                throw new Error(`Pointer dereference not a part of ${lang}`);

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
        case "AssignmentExpression":
            throw new Error(
                `Assignments 'x ${
                    syn.operator
                } e2' must be used as statements, and not inside of expressions.`
            );
        case "UpdateExpression":
            throw new Error(
                `Increment/decrement operations 'e${
                    syn.operator
                }' must be used as statements, and not inside of expressions.`
            );
        default:
            return impossible(syn);
    }
}

export function restrictLValue(lang: Lang, syn: Expression): ast.LValue {
    switch (syn.tag) {
        case "Identifier":
            return syn;
        case "StructMemberExpression": {
            if (lang === "L1" || lang === "L2" || lang === "L3")
                throw new Error(`Struct access not a part of ${lang}`);
            return {
                tag: "StructMemberExpression",
                deref: syn.deref,
                object: restrictLValue(lang, syn.object),
                field: syn.field
            };
        }
        case "UnaryExpression": {
            if (syn.operator !== "*") throw new Error(`Not an LValue`);
            if (lang == "L1" || lang === "L2" || lang === "L3")
                throw new Error(`Pointer dereference not a part of ${lang}`);
            return {
                tag: "UnaryExpression",
                operator: "*",
                argument: restrictLValue(lang, syn.argument)
            };
        }
        case "ArrayMemberExpression": {
            if (lang === "L1" || lang === "L2" || lang === "L3")
                throw new Error(`Array access not a part of ${lang}`);
            return {
                tag: "ArrayMemberExpression",
                object: restrictLValue(lang, syn.object),
                index: restrictExpression(lang, syn.index)
            };
        }

        case "IntLiteral":
        case "StringLiteral":
        case "CharLiteral":
        case "BoolLiteral":
        case "NullLiteral":
        case "CallExpression":
        case "IndirectCallExpression":
        case "CastExpression":
        case "BinaryExpression":
        case "LogicalExpression":
        case "ConditionalExpression":
        case "AllocExpression":
        case "AllocArrayExpression":
        case "ResultExpression":
        case "LengthExpression":
        case "HasTagExpression":
        case "UpdateExpression":
        case "AssignmentExpression":
            throw new Error(`Not a valid LValue`);
        default:
            return impossible(syn);
    }
}

export function restrictStatement(lang: Lang, syn: Statement): ast.Statement {
    switch (syn.tag) {
        case "ExpressionStatement": {
            switch (syn.expression.tag) {
                case "AssignmentExpression": {
                    if (lang === "L1") {
                        switch (syn.expression.operator) {
                            case "=":
                            case "*=":
                            case "/=":
                            case "%=":
                            case "+=":
                            case "-=":
                                break;
                            default:
                                throw new Error(
                                    `Assignment operator ${syn.expression.operator} not a part of ${lang}`
                                );
                        }
                    }
                    return {
                        tag: "AssignmentStatement",
                        operator: syn.expression.operator,
                        left: restrictLValue(lang, syn.expression.left),
                        right: restrictExpression(lang, syn.expression.right)
                    };
                }
                case "UpdateExpression": {
                    if (lang === "L1")
                        throw new Error(`Postfix update 'x${syn.expression.operator}' not a part of ${lang}`);

                    return {
                        tag: "UpdateStatement",
                        operator: syn.expression.operator,
                        argument: restrictExpression(lang, syn.expression.argument)
                    };
                }
                default: {
                    return {
                        tag: "ExpressionStatement",
                        expression: restrictExpression(lang, syn.expression)
                    };
                }
            }
        }
        case "VariableDeclaration": {
            return {
                tag: "VariableDeclaration",
                kind: restrictType(lang, syn.kind),
                id: syn.id,
                init: syn.init ? restrictExpression(lang, syn.init) : null
            };
        }
        case "IfStatement": {
            if (lang === "L1") throw new Error(`Conditionals not a part of ${lang}`);
            return {
                tag: "IfStatement",
                test: restrictExpression(lang, syn.test),
                consequent: restrictStatement(lang, syn.consequent)
            };
        }
        case "WhileStatement": {
            if (lang === "L1") throw new Error(`Loops not a part of ${lang}`);
            return {
                tag: "WhileStatement",
                invariants: syn.invariants.map(x => restrictExpression(lang, x)),
                test: restrictExpression(lang, syn.test),
                body: restrictStatement(lang, syn.body)
            };
        }
        case "ForStatement": {
            if (lang === "L1") throw new Error(`Loops not a part of ${lang}`);
            let init: ast.SimpleStatement | ast.VariableDeclaration | null;
            let test: ast.ExpressionStatement;
            let update: ast.SimpleStatement | null;

            if (syn.init === null) {
                init = null;
            } else {
                const candidate = restrictStatement(lang, syn.init);
                switch (candidate.tag) {
                    case "AssignmentStatement":
                    case "UpdateStatement":
                    case "ExpressionStatement":
                    case "VariableDeclaration":
                        init = candidate;
                        break;
                    default:
                        throw new Error(
                            `A ${candidate.tag} is not allowed as the first argument of a for statement`
                        );
                }
            }

            {
                const candidate = restrictStatement(lang, syn.test);
                switch (candidate.tag) {
                    case "ExpressionStatement":
                        test = candidate;
                        break;
                    default:
                        throw new Error(
                            `A ${candidate.tag} is not allowed as the second argument of a for statement`
                        );
                }
            }

            if (syn.update === null) {
                update = null;
            } else {
                const candidate = restrictStatement(lang, syn.update);
                switch (candidate.tag) {
                    case "AssignmentStatement":
                    case "UpdateStatement":
                    case "ExpressionStatement":
                        update = candidate;
                        break;
                    default:
                        throw new Error(
                            `A ${candidate.tag} is not allowed as the third argument of a for statement`
                        );
                }
            }

            return {
                tag: "ForStatement",
                invariants: syn.invariants.map(x => restrictExpression(lang, x)),
                init: init,
                test: test.expression,
                update: update,
                body: restrictStatement(lang, syn.body)
            };
        }

        case "ReturnStatement": {
            return {
                tag: "ReturnStatement",
                argument: syn.argument ? restrictExpression(lang, syn.argument) : null
            };
        }

        case "BlockStatement": {
            return {
                tag: "BlockStatement",
                body: syn.body.map(x => restrictStatement(lang, x))
            };
        }

        case "AssertStatement": {
            return {
                tag: "AssertStatement",
                contract: syn.contract,
                test: restrictStatement(lang, syn.test)
            };
        }

        default:
            return impossible(syn);
    }
}
