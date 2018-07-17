import { impossible } from "@calculemus/impossible";
import { error } from "./error";
import { GlobalEnv, getFunctionDeclaration, getStructDefinition, actualType } from "./globalenv";
import {
    Env,
    Synthed,
    isSubtype,
    typeSizeFullyDefined,
    leastUpperBoundSynthedType,
    actualSynthed
} from "./types";
import * as ast from "../ast";

export type mode =
    | null
    | { tag: "@requires" }
    | { tag: "@ensures"; returns: ast.Type }
    | { tag: "@loop_invariant" }
    | { tag: "@assert" };

/** Asserts that a synthesized type has small type */
export function synthLValue(genv: GlobalEnv, env: Env, mode: mode, exp: ast.LValue): ast.ValueType {
    let synthedType = synthExpression(genv, env, mode, exp);
    switch (synthedType.tag) {
        case "AmbiguousNullPointer":
            return error(`LValue cannot be null (should be impossible, please report)`);
        case "AnonymousFunctionTypePointer":
            return error(`LValue cannot be address-of (should be impossible, please report)`);
        case "NamedFunctionType":
            return error(`LValue has function type ${synthedType.definition.id.name}, which is not small`);
        case "VoidType":
            return error(`LValue cannot have void type`);
    }
    let actualSynthedType = actualType(genv, synthedType);
    switch (actualSynthedType.tag) {
        case "StructType": {
            return error(
                `assignment uses has type 'struct ${actualSynthedType.id.name}', which is not small`,
                "Assign the parts of the struct individually"
            );
        }
        case "NamedFunctionType":
            return error(
                `LValue has function type ${actualSynthedType.definition.id.name}, which is not small`
            );
        default:
            return synthedType;
    }
}

export function synthExpression(genv: GlobalEnv, env: Env, mode: mode, exp: ast.Expression): Synthed {
    switch (exp.tag) {
        case "Identifier": {
            const t = env.get(exp.name);
            if (t === undefined) {
                return error(`Undeclared variable ${exp.name}`);
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
            return { tag: "AmbiguousNullPointer" };
        case "ArrayMemberExpression": {
            let objectType = synthExpression(genv, env, mode, exp.object);
            if (
                objectType.tag === "AmbiguousNullPointer" ||
                objectType.tag === "AnonymousFunctionTypePointer" ||
                objectType.tag === "NamedFunctionType"
            )
                return error("subject of indexing '[...]' not an array"); // TODO: "inferred type t1"
            let actualObjectType = actualType(genv, objectType);
            if (actualObjectType.tag !== "ArrayType") {
                return error("subject of indexing '[...]' not an array"); // TODO: "inferred type t1"
            } else {
                checkExpression(genv, env, mode, exp.index, { tag: "IntType" });
                return actualObjectType.argument;
            }
        }
        case "StructMemberExpression": {
            let objectType = synthExpression(genv, env, mode, exp.object);
            if (
                objectType.tag === "AmbiguousNullPointer" ||
                objectType.tag === "AnonymousFunctionTypePointer" ||
                objectType.tag === "NamedFunctionType"
            )
                return error(`can only dereference structs and pointers to structs`);
            let actualObjectType = actualType(genv, objectType);
            if (exp.deref) {
                if (actualObjectType.tag === "StructType")
                    return error(
                        `cannot dereference non-pointer struct with e->${exp.field.name}`,
                        `try e.${exp.field.name}`
                    );
                if (actualObjectType.tag !== "PointerType")
                    return error("can only dereference structs and pointers to structs");
                actualObjectType = actualType(genv, actualObjectType.argument);
            }
            if (actualObjectType.tag !== "StructType")
                return error(
                    `subject of ${exp.deref ? "->" : "."}${exp.field.name} not a struct${
                        exp.deref ? " pointer" : ""
                    }`
                ); // TODO add inferred type
            let structDef = getStructDefinition(genv, actualObjectType.id.name);
            if (structDef === null) return error(`'struct ${actualObjectType.id.name}' not defined`);
            if (structDef.definitions === null)
                return error(`'struct ${actualObjectType.id.name}' declared but not defined`);
            for (let field of structDef.definitions) {
                if (field.id.name === exp.field.name) return field.kind;
            }
            return error(`field '${exp.field.name}' not declared in 'struct ${actualObjectType.id.name}'`);
        }
        case "CallExpression": {
            if (env.has(exp.callee.name))
                return error(
                    `variable ${exp.callee.name} used as function`,
                    `if ${exp.callee.name} is a function pointer, try try (*${
                        exp.callee.name
                    })(...)  instead of ${exp.callee.name}(...)`
                );
            const func = getFunctionDeclaration(genv, exp.callee.name);
            if (func === null) return error(`undeclared function ${exp.callee.name}`);
            if (exp.arguments.length !== func.params.length)
                return error(
                    `function ${exp.callee.name} requires ${func.params.length} argument${
                        func.params.length === 1 ? "" : "s"
                    } but was given ${exp.arguments.length}`
                );
            exp.arguments.forEach((exp, i) => checkExpression(genv, env, mode, exp, func.params[i].kind));
            return func.returns;
        }
        case "IndirectCallExpression": {
            const callType = synthExpression(genv, env, mode, exp.callee);
            if (callType.tag === "AnonymousFunctionTypePointer")
                return error("Functions pointers must be stored in locals before they are called");
            if (callType.tag === "AmbiguousNullPointer") return error("Cannot call NULL as a function");
            if (callType.tag === "NamedFunctionType")
                return error(
                    `Can only call pointers to functions, the function type '${
                        callType.definition.id.name
                    }' is not a pointer`
                );
            const actualCallType = actualType(genv, callType);
            if (actualCallType.tag !== "PointerType")
                return error("Only pointers to functions can be called");
            const actualFunctionType = actualType(genv, actualCallType.argument);
            if (actualFunctionType.tag !== "NamedFunctionType")
                return error("Only pointers to functions can be called");
            if (exp.arguments.length !== actualFunctionType.definition.params.length)
                return error(
                    `function pointer call requires ${actualFunctionType.definition.params.length} argument${
                        actualFunctionType.definition.params.length === 1 ? "" : "s"
                    } but was given ${exp.arguments.length}`
                );
            exp.arguments.forEach((exp, i) =>
                checkExpression(genv, env, mode, exp, actualFunctionType.definition.params[i].kind)
            );
            return actualFunctionType.definition.returns;
        }
        case "CastExpression": {
            const castType = actualType(genv, exp.kind);
            if (castType.tag !== "PointerType") return error("Type of cast must be a pointer or void*"); // TODO what was the type

            const argumentType = synthExpression(genv, env, mode, exp.argument);
            if (argumentType.tag === "AmbiguousNullPointer") return exp.kind; // NULL cast always ok
            if (
                argumentType.tag === "NamedFunctionType" ||
                argumentType.tag == "AnonymousFunctionTypePointer"
            )
                return error(
                    "Only function pointers with assigned types can be cast to 'void*'",
                    "assign to a variable and then cast to 'void*'"
                );
            const expandedArgumentType = actualType(genv, argumentType);
            if (expandedArgumentType.tag !== "PointerType")
                return error("Only pointer and void* types can be cast"); // TODO what was the type

            if (castType.argument.tag === "VoidType") {
                if (expandedArgumentType.argument.tag === "VoidType")
                    return error("Casting a void* as a void* not permitted\n");
            } else if (expandedArgumentType.argument.tag !== "VoidType") {
                return error("Only casts to or from void* allowed");
            }
            return exp.kind;
        }
        case "UnaryExpression": {
            switch (exp.operator) {
                case "!": {
                    checkExpression(genv, env, mode, exp.argument, { tag: "BoolType" });
                    return { tag: "BoolType" };
                }
                case "&": {
                    if (exp.argument.tag !== "Identifier")
                        return error(
                            "Address-of operation '&' can only be applied directly to a function name"
                        );
                    const definition = getFunctionDeclaration(genv, exp.argument.name);
                    if (definition === null) return error(`There is no function named ${exp.argument.name}`);
                    if (env.has(exp.argument.name))
                        return error(
                            `Cannot take the address of function ${
                                exp.argument.name
                            } when it is also the name of a local`
                        );
                    return { tag: "AnonymousFunctionTypePointer", definition: definition };
                }
                case "~":
                case "-": {
                    checkExpression(genv, env, mode, exp.argument, { tag: "IntType" });
                    return { tag: "IntType" };
                }
                case "*": {
                    const pointerType = synthExpression(genv, env, mode, exp.argument);
                    if (pointerType.tag === "AmbiguousNullPointer") return error("cannot dereference NULL");
                    if (pointerType.tag === "AnonymousFunctionTypePointer")
                        return error("Cannot dereference a pointer", "assign it to a variable first");
                    if (pointerType.tag === "NamedFunctionType")
                        return error(
                            "You only dereference a function pointer when that function is being called"
                        );
                    const actualPointerType = actualType(genv, pointerType);
                    switch (actualPointerType.tag) {
                        case "PointerType": {
                            if (actualPointerType.argument.tag === "VoidType") {
                                return error(
                                    "cannot dereference value of type 'void*'",
                                    "cast to another pointer type with '(t*)'"
                                );
                            } else {
                                return actualPointerType.argument;
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
                    checkExpression(genv, env, mode, exp.right, { tag: "IntType" });
                    return { tag: "IntType" };
                }

                case "<":
                case "<=":
                case ">=":
                case ">": {
                    const leftType = synthExpression(genv, env, mode, exp.left);
                    if (leftType.tag === "AmbiguousNullPointer")
                        return error(`Cannot compare pointers with ${exp.operator}`);
                    if (leftType.tag === "AnonymousFunctionTypePointer")
                        return error(`Cannot compare function pointers with ${exp.operator}`);
                    if (leftType.tag === "NamedFunctionType")
                        return error("Cannot compare functions for inequality");
                    switch (actualType(genv, leftType).tag) {
                        case "IntType":
                        case "CharType": {
                            checkExpression(genv, env, mode, exp.right, leftType);
                            return { tag: "BoolType" };
                        }
                        case "StringType": {
                            return error(
                                `cannot compare strings with '${exp.operator}'`,
                                "use string_compare in library <string>"
                            );
                        }
                        default: {
                            return error(
                                `cannot compare with '${exp.operator}' at this type`,
                                `only values of type 'int' and 'char' can be used with '${exp.operator}'`
                            ); // TODO which type
                        }
                    }
                }

                case "==":
                case "!=": {
                    const left = synthExpression(genv, env, mode, exp.left);
                    switch (left.tag) {
                        case "AmbiguousNullPointer": {
                            const right = synthExpression(genv, env, mode, exp.right);
                            if (right.tag === "AmbiguousNullPointer") return { tag: "BoolType" };
                            if (right.tag === "AnonymousFunctionTypePointer") return { tag: "BoolType" };
                            if (right.tag === "NamedFunctionType")
                                return error("cannot compare NULL and a function");
                            if (actualType(genv, right).tag === "PointerType") return { tag: "BoolType" };
                            else
                                return error(
                                    `cannot compare 'NULL' to a non-pointer type with ${exp.operator}`
                                );
                        }
                        case "AnonymousFunctionTypePointer": {
                            const right = synthExpression(genv, env, mode, exp.right);
                            if (right.tag === "AmbiguousNullPointer") return { tag: "BoolType" };
                            return error("can only compare an function pointer '&f' against NULL");
                        }
                    }
                    const actualLeft = actualType(genv, left);
                    switch (actualLeft.tag) {
                        case "NamedFunctionType":
                            return error(
                                `cannot compare functions for equality directly with ${exp.operator}`
                            );
                        case "StructType":
                            return error(
                                `cannot compare structs for equality directly with ${exp.operator}`,
                                "pointers to struts can be compared"
                            );
                        case "VoidType":
                            return error(`cannot compare void expressions for equality`);
                        case "StringType":
                            return error(
                                `cannot compare strings with '${exp.operator}'`,
                                "try using string_equal in library <string>"
                            );
                    }
                    checkExpression(genv, env, mode, exp.right, actualLeft);
                    return { tag: "BoolType" };
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
            const lub = leastUpperBoundSynthedType(genv, left, right);
            if (lub === null)
                return error("Branches of ternary expression 'e ? e1 : e2' have incompatible types"); // todo types
            const actualLub = actualSynthed(genv, lub);
            switch (actualLub.tag) {
                case "VoidType":
                    return error("condition expression branches cannot have void type");
                case "NamedFunctionType":
                    return error(
                        `functions with type ${
                            actualLub.definition.id.name
                        } cannot be returned from a conditional`,
                        "use function pointers"
                    );
                case "StructType":
                    return error(
                        `values of type 'struct${actualLub.id.name}' cannot be used in a conditional`,
                        "use struct pointers"
                    );
            }
            return lub;
        }
        case "AllocExpression": {
            const undefinedTypePart = typeSizeFullyDefined(genv, exp.kind);
            if (undefinedTypePart !== null)
                return error(
                    "cannot allocate an undefined type",
                    `give a definition for 'struct ${undefinedTypePart}`
                );
            return { tag: "PointerType", argument: exp.kind };
        }
        case "AllocArrayExpression": {
            const undefinedTypePart = typeSizeFullyDefined(genv, exp.kind);
            if (undefinedTypePart !== null)
                return error(
                    "cannot allocate an undefined type",
                    `give a definition for 'struct ${undefinedTypePart}`
                );
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
        return error("type mismatch"); // TODO: expected/found
    }
}
