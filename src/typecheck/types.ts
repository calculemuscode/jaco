import { impossible } from "@calculemus/impossible";
import { Map } from "immutable";
import { error } from "./error";
import { GlobalEnv, expandTypeDef } from "./globalenv";
import * as ast from "../ast";

export type Env = Map<string, ast.Type>;

export type Synthed = ast.Type | { tag: "AmbiguousPointer" };

/**
 * Checks that a value of the abstract type is usable in a hole requiring the concrete type:
 * in other words, checks that abstract <: concrete, where "<:" is the usual subtyping relationship.
 */
export function isSubtype(genv: GlobalEnv, abstract: Synthed, concrete: ast.Type): boolean {
    if (abstract.tag === "Identifier") return isSubtype(genv, expandTypeDef(genv, abstract), concrete);
    if (concrete.tag === "Identifier") return isSubtype(genv, abstract, expandTypeDef(genv, concrete));
    if (abstract.tag === "AmbiguousPointer") {
        return concrete.tag === "PointerType";
    }
    switch (abstract.tag) {
        case "IntType":
        case "BoolType":
        case "StringType":
        case "CharType":
        case "VoidType":
            return abstract.tag === concrete.tag;
        case "PointerType":
            return concrete.tag === "PointerType" && isSubtype(genv, abstract.argument, concrete.argument);
        case "ArrayType":
            return concrete.tag === "ArrayType" && isSubtype(genv, abstract.argument, concrete.argument);
        case "StructType":
            return concrete.tag === "StructType" && abstract.id.name === concrete.id.name;
        default:
            return impossible(abstract);
    }
}

export function checkTypeIsNotVoid(genv: GlobalEnv, t: ast.Type): void {
    switch (t.tag) {
        case "Identifier":
            return checkTypeIsNotVoid(genv, expandTypeDef(genv, t));
        case "VoidType":
            return error(
                "illegal use of type 'void'",
                "'void' can only be used as a return type for functions"
            );
        case "IntType":
            return;
        case "BoolType":
            return;
        case "StringType":
            return;
        case "CharType":
            return;
        case "PointerType": {
            if (t.argument.tag === "VoidType") return;
            checkTypeIsNotVoid(genv, t.argument);
        }
        case "ArrayType":
            return checkTypeIsNotVoid(genv, t.argument);
        case "StructType":
            return; // Always okay, even if not defined
        default:
            return impossible(t);
    }
}

/** Asserts type mentioned in variable declaration or function argument has small type */
export function checkTypeInDeclaration(genv: GlobalEnv, tp: ast.Type, isFunctionArg?: boolean): void {
    if (tp.tag === "Identifier") tp = expandTypeDef(genv, tp);
    switch (tp.tag) {
        case "StructType": {
            error(
                `type struct ${tp.id.name} not small`,
                isFunctionArg
                    ? "cannot pass structs to or from functions; use pointers"
                    : "cannot store structs as locals; use pointers"
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
