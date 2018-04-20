import { Lang } from "./lang";
import * as ast from "./ast";
import * as parsed from "./parsedsyntax";
import { impossible } from "@calculemus/impossible";

export function restrictType(lang: Lang, syn: parsed.Type): ast.Type {
    return null;
}

export function restrictExpression(lang: Lang, syn: parsed.Expression): ast.Expression {
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
        case "AssertExpression":
            throw new Error(
                `The 'assert()' function must be used as a statement, and not inside of expressions.`
            );
        case "ErrorExpression":
            throw new Error(
                `The 'error()' function must be used as a statement, and not inside of expressions.`
            );
        default:
            return impossible(syn);
    }
}

export function restrictLValue(lang: Lang, syn: parsed.Expression): ast.LValue {
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
        case "AssertExpression":
        case "ErrorExpression":
            throw new Error(`Not a valid LValue ${JSON.stringify(syn)}`);
        default:
            return impossible(syn);
    }
}

export function restrictStatement(lang: Lang, syn: parsed.Statement): ast.Statement {
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
                case "AssertExpression": {
                    if (lang === "L1" || lang === "L2" || lang === "L3" || lang === "L4") {
                        throw new Error(`Assertions not a part of ${lang}`);
                    }
                    return {
                        tag: "AssertStatement",
                        contract: false,
                        test: restrictExpression(lang, syn.expression.test)
                    };
                }
                case "ErrorExpression": {
                    if (lang === "L1" || lang === "L2" || lang === "L3" || lang === "L4") {
                        throw new Error(`The 'error()' function is not a part of ${lang}`);
                    }
                    return {
                        tag: "ErrorStatement",
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
        case "BreakStatement":
        case "ContinueStatement": {
            if (lang !== "C1") throw new Error(`Control with 'break' and 'continue' not a part of ${lang}`);
            return syn;
        }
        default:
            return impossible(syn);
    }
}
