import { impossible } from "@calculemus/impossible";
import { GlobalEnv, getFunctionDeclaration, getStructDefinition, actualType } from "./globalenv";
import {
    Env,
    Synthed,
    isSubtype,
    typeSizeFullyDefined,
    leastUpperBoundSynthedType,
    actualSynthed
} from "./types";
import { error } from "./error";
import * as ast from "../ast";
import { ImpossibleError, TypingError } from "../error";
//import { typeToString } from "../print";

export type mode =
    | null
    | { tag: "@requires" }
    | { tag: "@ensures"; returns: ast.Type }
    | { tag: "@loop_invariant" }
    | { tag: "@assert" };

function valueDescription(genv: GlobalEnv, tp: Synthed): string {
    const t = actualSynthed(genv, tp);
    switch (t.tag) {
        case "IntType":
            return "an integer";
        case "BoolType":
            return "a boolean";
        case "StringType":
            return "a string";
        case "CharType":
            return "a character";
        case "VoidType":
            return "a void expression";
        case "PointerType":
            return "a pointer";
        case "ArrayType":
            return "an array";
        case "StructType":
            return "a struct";
        case "AmbiguousNullPointer":
            return "a pointer";
        case "AnonymousFunctionTypePointer":
            return "a pointer";
        case "NamedFunctionType":
            return "a function";
        default:
            return impossible(t);
    }
}

/** Asserts that a synthesized type has small type */
export function synthLValue(genv: GlobalEnv, env: Env, mode: mode, exp: ast.LValue): ast.ValueType {
    let synthedType = synthExpression(genv, env, mode, exp);
    switch (synthedType.tag) {
        case "AmbiguousNullPointer":
            throw new ImpossibleError("lvalue cannot be null");
        case "AnonymousFunctionTypePointer":
            throw new ImpossibleError("lvalue cannot be address-of");
        case "NamedFunctionType":
            throw new TypingError(
                exp,
                `cannot assign expression with function type ${synthedType.definition.id.name}`,
                "use pointers to functions"
            );
        case "VoidType":
            throw new TypingError(exp, "cannot assign to an expression with type 'void'");
    }
    let actualSynthedType = actualType(genv, synthedType);
    switch (actualSynthedType.tag) {
        case "StructType": {
            throw new TypingError(
                exp,
                `cannot assign expression with type 'struct ${actualSynthedType.id.name}'`,
                "Assign the parts of the struct individually"
            );
        }
        case "NamedFunctionType":
            throw new TypingError(
                exp,
                `cannot assign expression with function type ${actualSynthedType.definition.id.name}`,
                "use pointers to functions"
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
                throw new TypingError(exp, `variable ${exp.name} not declared`);
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
            let objectType = actualSynthed(genv, synthExpression(genv, env, mode, exp.object));
            if (objectType.tag !== "ArrayType") {
                throw new TypingError(
                    exp,
                    `subject of indexing '[...]' is ${valueDescription(genv, objectType)}, not an array`
                );
            } else {
                checkExpression(genv, env, mode, exp.index, { tag: "IntType" });
                return objectType.argument;
            }
        }
        case "StructMemberExpression": {
            let objectType = actualSynthed(genv, synthExpression(genv, env, mode, exp.object));
            if (exp.deref) {
                if (objectType.tag === "StructType")
                    throw new TypingError(
                        exp,
                        `cannot dereference non-pointer struct with e->${exp.field.name}`,
                        `try e.${exp.field.name}`
                    );
                if (objectType.tag !== "PointerType")
                    throw new TypingError(
                        exp,
                        `subject of dereference '->${exp.field.name}' is ${valueDescription(
                            genv,
                            objectType
                        )}, not a pointer to a struct`
                    );
                objectType = actualType(genv, objectType.argument);
                if (objectType.tag !== "StructType")
                    throw new TypingError(
                        exp,
                        `subject of dereference '->${exp.field.name}' is a pointer to ${valueDescription(
                            genv,
                            objectType
                        )}, not a pointer to a struct`
                    );
            } else {
                if (objectType.tag !== "StructType")
                    throw new TypingError(
                        exp,
                        `subject of access '.${exp.field.name}' is ${valueDescription(
                            genv,
                            objectType
                        )}, not a struct`
                    );
            }
            let structDef = getStructDefinition(genv, objectType.id.name);
            if (structDef === null)
                throw new TypingError(
                    exp,
                    `subject of access '${exp.deref ? "->" : "."}${exp.field.name}' is 'struct ${
                        objectType.id.name
                    }', which is not defined`
                );
            if (structDef.definitions === null)
                throw new TypingError(
                    exp,
                    `subject of access '${exp.deref ? "->" : "."}${exp.field.name}' is 'struct ${
                        objectType.id.name
                    }', which is declared but not defined`
                );
            for (let field of structDef.definitions) {
                if (field.id.name === exp.field.name) return field.kind;
            }
            throw new TypingError(
                exp,
                `field '${exp.field.name}' not declared in 'struct ${objectType.id.name}'`
            );
        }
        case "CallExpression": {
            if (env.has(exp.callee.name))
                throw new TypingError(
                    exp,
                    `local '${exp.callee.name}' is ${valueDescription(
                        genv,
                        actualType(genv, env.get(exp.callee.name)!)
                    )}, not a function`
                );
            const func = getFunctionDeclaration(genv, exp.callee.name);
            if (func === null) throw new TypingError(exp, `function ${exp.callee.name} not declared`);
            if (exp.arguments.length !== func.params.length)
                throw new TypingError(
                    exp,
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
                throw new TypingError(
                    exp,
                    "function pointers must be stored in locals before they are called"
                );
            if (callType.tag === "AmbiguousNullPointer")
                throw new TypingError(exp, "cannot call 'NULL' as a function");
            if (callType.tag === "NamedFunctionType")
                throw new TypingError(
                    exp,
                    `Can only call pointers to functions, the function type '${
                        callType.definition.id.name
                    }' is not a pointer`
                );
            const actualCallType = actualType(genv, callType);
            if (actualCallType.tag !== "PointerType")
                throw new TypingError(exp, "only pointers to functions can be called");
            const actualFunctionType = actualType(genv, actualCallType.argument);
            if (actualFunctionType.tag !== "NamedFunctionType")
                throw new TypingError(exp, "only pointers to functions can be called");
            if (exp.arguments.length !== actualFunctionType.definition.params.length)
                throw new TypingError(
                    exp,
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
            if (castType.tag !== "PointerType")
                throw new TypingError(
                    exp,
                    `casts must be pointer types, not ${valueDescription(genv, castType)}`
                );

            const argumentType = actualSynthed(genv, synthExpression(genv, env, mode, exp.argument));
            if (argumentType.tag === "AmbiguousNullPointer") return exp.kind; // NULL cast always ok
            if (
                argumentType.tag === "NamedFunctionType" ||
                argumentType.tag == "AnonymousFunctionTypePointer"
            )
                throw new TypingError(
                    exp,
                    "only function pointers with assigned types can be cast to 'void*'",
                    "assign to a variable and then cast to 'void*'"
                );
            if (argumentType.tag !== "PointerType")
                throw new TypingError(
                    exp,
                    `casts must be pointer types, not ${valueDescription(genv, argumentType)}`
                );

            if (castType.argument.tag === "VoidType") {
                if (argumentType.argument.tag === "VoidType")
                    throw new TypingError(exp, "Casting a 'void*' as a 'void*' not permitted\n");
            } else if (argumentType.argument.tag !== "VoidType") {
                throw new TypingError(exp, "only casts to or from 'void*' allowed");
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
                        throw new TypingError(
                            exp,
                            "address-of operation '&' can only be applied directly to a function name"
                        );
                    const definition = getFunctionDeclaration(genv, exp.argument.name);
                    if (definition === null) throw new TypingError(exp, `There is no function named ${exp.argument.name}`);
                    if (env.has(exp.argument.name))
                        throw new TypingError(exp, 
                            `cannot take the address of function ${
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
                    const pointerType = actualSynthed(genv, synthExpression(genv, env, mode, exp.argument));
                    switch (pointerType.tag) {
                        case "AmbiguousNullPointer": {
                            throw new TypingError(exp, "cannot dereference 'NULL'");
                        }
                        case "AnonymousFunctionTypePointer": {
                            throw new TypingError(exp, "cannot dereference a function pointer immediately", "assign it to a local first");
                        }
                        case "PointerType": {
                            if (pointerType.argument.tag === "VoidType") {
                                throw new TypingError(exp, 
                                    "cannot dereference value of type 'void*'",
                                    "cast to another pointer type with '(t*)'"
                                );
                            } else {
                                return pointerType.argument;
                            }
                        }
                        default:
                            throw new TypingError(exp, `only pointers can be dereferenced ${valueDescription(genv, pointerType)}`);
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
                    const leftType = actualSynthed(genv, synthExpression(genv, env, mode, exp.left));
                    switch (leftType.tag) {
                        case "IntType":
                        case "CharType": {
                            checkExpression(genv, env, mode, exp.right, leftType);
                            return { tag: "BoolType" };
                        }
                        case "StringType": {
                            return error(
                                `cannot compare a string with '${exp.operator}'`,
                                "use string_compare in library <string>"
                            );
                        }
                        default: {
                            throw new TypingError(exp,
                                `cannot compare ${valueDescription(genv, leftType)} with '${exp.operator}'`,
                                `only values of type 'int' and 'char' can be used with '${exp.operator}'`
                            );
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
