import { impossible } from "@calculemus/impossible";
import { Map } from "immutable";
import { error } from "./error";
import { actualType, GlobalEnv } from "./globalenv";
import * as ast from "../ast";

export type Env = Map<string, ast.Type>;

export type Synthed =
    | ast.Type
    | { tag: "AmbiguousNullPointer" }
    | { tag: "NamedFunctionType"; definition: ast.FunctionDeclaration }
    | { tag: "AnonymousFunctionTypePointer"; definition: ast.FunctionDeclaration };

export function equalTypes(genv: GlobalEnv, t1: ast.Type, t2: ast.Type): boolean {
    const actual1 = actualType(genv, t1);
    const actual2 = actualType(genv, t2);
    switch (actual1.tag) {
        case "IntType":
        case "BoolType":
        case "StringType":
        case "CharType":
        case "VoidType":
            return actual1.tag === actual2.tag;
        case "ArrayType":
        case "PointerType":
            return actual1.tag === actual2.tag && equalTypes(genv, actual1.argument, actual2.argument);
        case "StructType":
            return actual1.tag === actual2.tag && actual1.id.name === actual2.id.name;
        case "NamedFunctionType":
            return actual1.tag === actual2.tag && actual1.definition.id.name === actual2.definition.id.name;
        default:
            return impossible(actual1);
    }
}

export function equalFunctionTypes(
    genv: GlobalEnv,
    decl1: ast.FunctionDeclaration,
    decl2: ast.FunctionDeclaration
): boolean {
    if (!equalTypes(genv, decl1.returns, decl2.returns)) return false;
    if (decl1.params.length !== decl2.params.length) return false;
    for (let i = 0; i < decl1.params.length; i++) {
        if (!equalTypes(genv, decl1.params[i].kind, decl2.params[i].kind)) return false;
    }
    return true;
}

/**
 * Least upper bound is only used by e ? e1 : e2, to determine the type of e1 and e2 from the type of e
 */
function leastUpperBoundType(genv: GlobalEnv, t1: ast.Type, t2: ast.Type): ast.Type | null {
    const actual1 = actualType(genv, t1);
    const actual2 = actualType(genv, t2);
    switch (actual1.tag) {
        case "IntType":
        case "BoolType":
        case "StringType":
        case "CharType":
        case "VoidType":
            return actual1.tag === actual2.tag ? t1 : null;
        case "ArrayType":
        case "PointerType": {
            if (actual1.tag !== actual2.tag) return null;
            const sublub = leastUpperBoundType(genv, actual1.argument, actual2.argument);
            if (sublub === null) return null;
            return actual1.tag === "ArrayType"
                ? { tag: actual1.tag, argument: sublub }
                : { tag: actual1.tag, argument: sublub };
        }
        case "StructType":
            return actual1.tag === actual2.tag && actual1.id.name === actual2.id.name ? t1 : null;
        case "NamedFunctionType":
            return actual1.tag === actual2.tag && actual1.definition.id.name === actual2.definition.id.name
                ? t1
                : null;
        default:
            return impossible(actual1);
    }
}

/**
 * Almost entirely here to deal with the mess that is functions, and only then because of conditionals;
 */
export function leastUpperBoundSynthedType(genv: GlobalEnv, t1: Synthed, t2: Synthed): Synthed | null {
    if (t1.tag === "AmbiguousNullPointer" || t2.tag === "AmbiguousNullPointer") {
        if (t1.tag === t2.tag) return t1;
        if (t1.tag === "PointerType" || t1.tag === "AnonymousFunctionTypePointer") return t1;
        if (t2.tag === "PointerType" || t2.tag === "AnonymousFunctionTypePointer") return t2;
        return null;
    }

    if (t1.tag === "AnonymousFunctionTypePointer") {
        if (t2.tag === "AnonymousFunctionTypePointer") {
            return equalFunctionTypes(genv, t1.definition, t2.definition) ? t1 : null;
        } else if (t2.tag === "NamedFunctionType") {
            return error(
                `Named function type ${t2.definition.id.name} is not equal to a function pointer`,
                "don't dereference the function pointer"
            );
        } else {
            const actual2 = actualType(genv, t2);
            if (actual2.tag !== "PointerType") return null;
            const actual2arg = actualType(genv, actual2.argument);
            if (actual2arg.tag !== "NamedFunctionType") return null;
            return equalFunctionTypes(genv, t1.definition, actual2arg.definition) ? t1 : null;
        }
    } else if (t2.tag === "AnonymousFunctionTypePointer") {
        if (t1.tag === "NamedFunctionType") {
            return error(
                `Named function type ${t1.definition.id.name} is not equal to a function pointer`,
                `try not dereferencing ${t1.definition.id.name}`
            );
        } else {
            const actual1 = actualType(genv, t1);
            if (actual1.tag !== "PointerType") return null;
            const actual1arg = actualType(genv, actual1.argument);
            if (actual1arg.tag !== "NamedFunctionType") return null;
            return equalFunctionTypes(genv, actual1arg.definition, t2.definition) ? t2 : null;
        }
    } else if (t1.tag === "NamedFunctionType" || t2.tag === "NamedFunctionType") {
        return t1.tag === "NamedFunctionType" &&
            t2.tag === "NamedFunctionType" &&
            t1.definition.id.name == t2.definition.id.name
            ? t1
            : null;
    } else {
        return leastUpperBoundType(genv, t1, t2);
    }
}

/**
 * Checks that a value of the abstract type is usable in a hole requiring the concrete type:
 * in other words, checks that abstract <: concrete, where "<:" is the usual subtyping relationship.
 */
export function isSubtype(genv: GlobalEnv, abstract: Synthed, concrete: ast.Type): boolean {
    const actualConcrete = actualType(genv, concrete);
    if (abstract.tag === "AmbiguousNullPointer") {
        return actualConcrete.tag === "PointerType";
    } else if (abstract.tag === "NamedFunctionType") {
        return (
            actualConcrete.tag === "NamedFunctionType" &&
            abstract.definition.id.name === actualConcrete.definition.id.name
        );
    } else if (abstract.tag === "AnonymousFunctionTypePointer") {
        if (actualConcrete.tag !== "PointerType") return false;
        const concreteFunctionType = actualType(genv, actualConcrete.argument);
        return (
            concreteFunctionType.tag === "NamedFunctionType" &&
            equalFunctionTypes(genv, abstract.definition, concreteFunctionType.definition)
        );
    }
    const actualAbstract = actualType(genv, abstract);
    switch (actualAbstract.tag) {
        case "IntType":
        case "BoolType":
        case "StringType":
        case "CharType":
        case "VoidType":
            return actualAbstract.tag === actualConcrete.tag;
        case "PointerType":
            return (
                actualConcrete.tag === "PointerType" &&
                isSubtype(genv, actualAbstract.argument, actualConcrete.argument)
            );
        case "ArrayType":
            return (
                actualConcrete.tag === "ArrayType" &&
                isSubtype(genv, actualAbstract.argument, actualConcrete.argument)
            );
        case "StructType":
            return actualConcrete.tag === "StructType" && actualAbstract.id.name === actualConcrete.id.name;
        case "NamedFunctionType":
            return (
                actualConcrete.tag === "NamedFunctionType" &&
                actualAbstract.definition.id.name === actualConcrete.definition.id.name
            );
        default:
            return impossible(actualAbstract);
    }
}

export function checkTypeIsNotVoid(genv: GlobalEnv, tp: ast.Type): void {
    const actual = actualType(genv, tp);
    switch (actual.tag) {
        case "VoidType":
            return error(
                "illegal use of type 'void'",
                "'void' can only be used as a return type for functions"
            );
        case "PointerType": {
            if (actual.argument.tag === "VoidType") return;
            checkTypeIsNotVoid(genv, actual.argument);
        }
        case "ArrayType":
            return checkTypeIsNotVoid(genv, actual.argument);
        case "IntType":
        case "BoolType":
        case "StringType":
        case "CharType":
        case "StructType": // Always okay, even if not defined
        case "NamedFunctionType": // This case is actually impossible
            return;
        default:
            return impossible(actual);
    }
}

/** Asserts type mentioned in variable declaration or function argument has small type */
export function checkTypeInDeclaration(genv: GlobalEnv, tp: ast.Type, isFunctionArg?: boolean): void {
    const actual = actualType(genv, tp);
    switch (actual.tag) {
        case "StructType": {
            return error(
                `type struct ${actual.id.name} not small`,
                isFunctionArg
                    ? "cannot pass structs to or from functions; use pointers"
                    : "cannot store structs as locals; use pointers"
            );
        }
        case "NamedFunctionType": {
            return error(
                `Function type ${actual.definition.id.name} is not small`,
                isFunctionArg
                    ? "cannot pass functions directly to or from functions; use pointers"
                    : "cannot store functions as locals; store a function pointer"
            );
        }
        default:
            return checkTypeIsNotVoid(genv, tp);
    }
}

/** Checks a valid function return type */
export function checkFunctionReturnType(genv: GlobalEnv, t: ast.Type) {
    switch (t.tag) {
        case "VoidType":
            return;
        default:
            return checkTypeInDeclaration(genv, t, true);
    }
}
