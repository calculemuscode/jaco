import { impossible } from "@calculemus/impossible";
import { error } from "./error";
import { GlobalEnv, expandTypeDef, getFunctionDeclaration, getStructDefinition } from "./globalenv";
import { Env, Synthed, isSubtype } from "./types";
import * as ast from "../ast";

export type mode =
    | null
    | { tag: "@requires" }
    | { tag: "@ensures"; returns: ast.Type }
    | { tag: "@loop_invariant" }
    | { tag: "@assert" };

/** Asserts that a synthesized type has small type */
export function synthSmallExpression(
    genv: GlobalEnv,
    env: Env,
    mode: mode,
    exp: ast.Expression,
    place: string
): Synthed {
    let tp = synthExpression(genv, env, mode, exp);
    if (tp.tag === "Identifier") tp = expandTypeDef(genv, tp);
    switch (tp.tag) {
        case "StructType": {
            return error(
                `expression has struct type`,
                `a ${place} cannot contain structs; consider using pointers`
            ); // todo name type
        }
        default:
            return tp;
    }
}

export function synthExpression(genv: GlobalEnv, env: Env, mode: mode, exp: ast.Expression): Synthed {
    switch (exp.tag) {
        case "Identifier": {
            const t = env.get(exp.name);
            if (t === undefined) {
                return error(`Undeclared variable ${exp.tag}`);
            } else {
                return t;
            }
        }
        case "IntLiteral":
            return { tag: "IntType" };
        case "StringLiteral":
            return { tag: "StringType" };
        case "CharLiteral":
            return { tag: "CharType" };
        case "BoolLiteral":
            return { tag: "BoolType" };
        case "NullLiteral":
            return { tag: "AmbiguousPointer" };
        case "ArrayMemberExpression": {
            let objectType = synthExpression(genv, env, mode, exp.object);
            if (objectType.tag === "Identifier") objectType = expandTypeDef(genv, objectType);
            if (objectType.tag !== "ArrayType") {
                return error("subject of indexing '[...]' not an array"); // TODO: "inferred type t1"
            } else {
                checkExpression(genv, env, mode, exp.index, { tag: "IntType" });
                return objectType.argument;
            }
        }
        case "StructMemberExpression": {
            let objectType = synthExpression(genv, env, mode, exp.object);
            if (objectType.tag === "Identifier") objectType = expandTypeDef(genv, objectType);
            if (exp.deref) {
                if (objectType.tag === "AmbiguousPointer") return error("cannot dereference NULL");
                if (objectType.tag === "StructType") return error(`cannot dereference non-pointer struct with e->${exp.field.name}`, `try e.${exp.field.name}`);
                if (objectType.tag !== "PointerType") return error("can only dereference structs and pointers to structs");
                objectType = objectType.argument;
            }
            if (objectType.tag === "Identifier") objectType = expandTypeDef(genv, objectType);
            if (objectType.tag !== "StructType") return error(`subject of ${exp.deref ? "->" : "."}${exp.field.name} not a struct${exp.deref ? " pointer" : ""}`); // TODO add inferred type
            let structDef = getStructDefinition(genv, objectType.id.name);
            if (structDef === null) return error(`'struct ${objectType.id.name}' not defined`);
            if (structDef.definitions.length === 0) return error(`'struct ${objectType}' declared but not defined`);
            for (let field of structDef.definitions) {
                if (field.id.name === exp.field.name) return field.kind;
            }
            return error(`field '${exp.field.name}' not declared in 'struct ${objectType.id.name}'`);
        }
        case "CallExpression": {
            if (env.has(exp.callee.name)) return error(`variable ${exp.callee.name} used as function`, `if ${exp.callee.name} is a function pointer, try try (*${exp.callee.name})(...)  instead of ${exp.callee.name}(...)`)
            const func = getFunctionDeclaration(genv, exp.callee.name);
            if (func === null) return error(`undeclared function ${exp.callee.name}`);
            if (exp.arguments.length !== func.params.length) return error(`function ${exp.callee.name} requires ${func.params.length} argument${func.params.length === 1 ? "" : "s"} but was given ${exp.arguments.length}`);
            exp.arguments.forEach((exp, i) => checkExpression(genv, env, mode, exp, func.params[i].kind));
            return func.returns;
        }
        case "IndirectCallExpression": {
            return { tag: "IntType" }; // Bogus
        }
        case "CastExpression": {
            return { tag: "IntType" }; // Bogus
        }
        case "UnaryExpression": {
            switch (exp.operator) {
                case "!": {
                    checkExpression(genv, env, mode, exp.argument, { tag: "BoolType" });
                    return { tag: "BoolType" };
                }
                case "&":
                case "~":
                case "-": {
                    checkExpression(genv, env, mode, exp.argument, { tag: "IntType" });
                    return { tag: "IntType" };
                }
                case "*": {
                    const tp = synthExpression(genv, env, mode, exp.argument);
                    switch (tp.tag) {
                        case "AmbiguousPointer":
                            return error("cannot dereference NULL");
                        case "PointerType": {
                            if (tp.argument.tag === "VoidType") {
                                return error(
                                    "cannot dereference value of type 'void*'",
                                    "cast to another pointer type with '(t*)'"
                                );
                            } else {
                                return tp.argument;
                            }
                        }
                        default:
                            return error("subject of '*' not a pointer"); // TODO: inferred type
                    }
                }
                default:
                    return impossible(exp.operator);
            }
        }
        case "BinaryExpression": {
            switch (exp.operator) {
                case "*":
                case "/":
                case "%":
                case "+":
                case "-":
                case "<<":
                case ">>":
                case "&":
                case "^":
                case "|": {
                    checkExpression(genv, env, mode, exp.left, { tag: "IntType" });
                    checkExpression(genv, env, mode, exp.left, { tag: "IntType" });
                    return { tag: "IntType" };
                }

                case "<":
                case "<=":
                case ">=":
                case ">": {
                    checkExpression(genv, env, mode, exp.left, { tag: "IntType" });
                    checkExpression(genv, env, mode, exp.left, { tag: "IntType" });
                    return { tag: "BoolType" };
                }

                case "==":
                case "!=": {
                    const left = synthExpression(genv, env, mode, exp.left);
                    const right = synthExpression(genv, env, mode, exp.right);
                    left;
                    right;
                    return { tag: "BoolType" }; // Bogus
                }
                default:
                    return impossible(exp.operator);
            }
        }
        case "LogicalExpression": {
            checkExpression(genv, env, mode, exp.left, { tag: "BoolType" });
            checkExpression(genv, env, mode, exp.right, { tag: "BoolType" });
            return { tag: "BoolType" };
        }
        case "ConditionalExpression": {
            checkExpression(genv, env, mode, exp.test, { tag: "BoolType" });
            const left = synthExpression(genv, env, mode, exp.consequent);
            const right = synthExpression(genv, env, mode, exp.alternate);
            right;
            return left; // Bogus
        }
        case "AllocExpression": {
            // TODO check type
            return { tag: "PointerType", argument: exp.kind };
        }
        case "AllocArrayExpression": {
            // TODO check type
            checkExpression(genv, env, mode, exp.size, { tag: "IntType" });
            return { tag: "ArrayType", argument: exp.kind };
        }
        case "ResultExpression": {
            if (mode === null)
                return error("\\result illegal in ordinary expressions", "use only in @ensures annotations");
            else if (mode.tag === "@ensures") {
                if (mode.returns.tag === "VoidType") {
                    return error("\\result illegal in functions that return 'void'");
                } else {
                    return mode.returns;
                }
            } else {
                return error(
                    `\\result illegal in ${mode.tag} annotations`,
                    "use only in @ensures annotations"
                );
            }
        }
        case "LengthExpression": {
            if (mode === null)
                return error("\\length illegal in ordinary expressions", "use only in annotations");
            const tp = synthExpression(genv, env, mode, exp.argument);
            if (tp.tag !== "ArrayType") {
                return error("argument to \\length not an array");
            } else {
                return { tag: "IntType" };
            }
        }
        case "HasTagExpression": {
            if (mode === null)
                return error("\\hastag illegal in ordinary expressions", "use only in annotations");
            if (exp.kind.tag !== "PointerType") return error("tag must be a pointer type"); // TODO prettyprint;
            if (exp.kind.argument.tag === "VoidType") return error("tag can never be 'void*'");
            const tp = synthExpression(genv, env, mode, exp.argument);
            if (tp.tag !== "PointerType" || tp.argument.tag !== "VoidType") {
                return error("tagged expression must have type void*"); // TODO inferred
            }
        }
        default:
            return impossible(exp as never);
    }
}

export function checkExpression(
    genv: GlobalEnv,
    env: Env,
    mode: mode,
    exp: ast.Expression,
    tp: ast.Type
): void {
    const synthed = synthExpression(genv, env, mode, exp);
    if (!isSubtype(genv, synthed, tp)) {
        console.log(synthed);
        console.log(tp);
        console.log(exp);
        return error("type mismatch"); // TODO: expected/found
    }
}
