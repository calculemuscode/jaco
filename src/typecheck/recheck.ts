import { GlobalEnv, getStructDefinition, actualType, getFunctionDeclaration, ActualType } from "./globalenv";
import { Env } from "./types";
import {
    Type,
    IntType,
    BoolType,
    StringType,
    CharType,
    VoidType,
    Expression,
    StructDeclaration,
    FunctionDeclaration
} from "../ast";
import { impossible } from "../../node_modules/@calculemus/impossible";
import { ImpossibleError } from "../error";

export type ConcreteType =
    | IntType
    | BoolType
    | StringType
    | CharType
    | VoidType
    | { tag: "PointerType"; argument: ConcreteType }
    | { tag: "ArrayType"; argument: ConcreteType }
    | { tag: "StructType"; id: string; definition: { id: string; kind: ConcreteType }[] | null }
    | { tag: "NamedFunctionType"; id: string; arguments: ConcreteType[]; returns: ConcreteType };

// Use the pointer equality for the GlobalEnv to control a cache
// This cache is designed to keep us from calculating the concrete type of a struct
// more than once
let globalEnvWithCache: GlobalEnv | null = null;
let structCache = new Map<string, ConcreteType>();
export function concrete(genv: GlobalEnv, kind: Type): ConcreteType {
    const actual = actualType(genv, kind);
    if (actual.tag === "StructType") {
        if (globalEnvWithCache === genv) {
            if (!structCache.has(actual.id.name))
                structCache.set(actual.id.name, concreteNoCache(genv, actual));
        } else {
            globalEnvWithCache = genv;
            structCache = new Map();
            structCache.set(actual.id.name, concreteNoCache(genv, actual));
        }
        return structCache.get(actual.id.name)!;
    } else {
        return concreteNoCache(genv, actual);
    }
}

function concreteNoCache(genv: GlobalEnv, actual: ActualType | VoidType): ConcreteType {
    switch (actual.tag) {
        case "IntType":
        case "BoolType":
        case "StringType":
        case "CharType":
        case "VoidType":
            return actual;
        case "NamedFunctionType":
            return {
                tag: "NamedFunctionType",
                id: actual.definition.id.name,
                arguments: actual.definition.params.map(x => concrete(genv, x.kind)),
                returns: concrete(genv, actual.definition.returns)
            };
        case "PointerType":
            return { tag: "PointerType", argument: concrete(genv, actual.argument) };
        case "ArrayType":
            return { tag: "ArrayType", argument: concrete(genv, actual.argument) };
        case "StructType":
            const definition = getStructDefinition(genv, actual.id.name);
            return {
                tag: "StructType",
                id: actual.id.name,
                definition:
                    definition &&
                    definition.definitions &&
                    definition.definitions.map(x => ({ id: x.id.name, kind: concrete(genv, x.kind) }))
            };
        default:
            return impossible(actual);
    }
}

/**
 * In compilation, it is sometimes necessary to re-check the type of an expression.
 */
export function recheck(genv: GlobalEnv, env: Env, exp: Expression): ConcreteType {
    switch (exp.tag) {
        case "Identifier":
            return concrete(genv, env.get(exp.name)!);
        case "IntLiteral":
            return { tag: "IntType" };
        case "StringLiteral":
            return { tag: "StringType" };
        case "CharLiteral":
            return { tag: "CharType" };
        case "BoolLiteral":
            return { tag: "BoolType" };
        case "NullLiteral":
            throw new ImpossibleError("Synthesizing type of NULL");
        case "ArrayMemberExpression": {
            const kind = recheck(genv, env, exp.object);
            if (kind.tag !== "ArrayType") throw new ImpossibleError("Object not an array");
            return kind.argument;
        }
        case "StructMemberExpression": {
            const kind = recheck(genv, env, exp.object);
            if (kind.tag !== "StructType") throw new ImpossibleError("Object not a struct");
            if (kind.definition === null || kind.definition === null)
                throw new ImpossibleError("Object not a defined struct");
            for (let decl of kind.definition) {
                if (decl.id === exp.field.name) return decl.kind;
            }
            throw new ImpossibleError(`Object not a struct with field ${exp.field.name}`);
        }
        case "CallExpression": {
            const definition = getFunctionDeclaration(genv, exp.callee.name);
            if (definition === null) throw new ImpossibleError(`Function ${exp.callee.name} not defined`);
            return concrete(genv, definition.returns);
        }
        case "IndirectCallExpression": {
            const kind = recheck(genv, env, exp.callee);
            if (kind.tag !== "PointerType") throw new ImpossibleError(`Calling non-pointer`);
            if (kind.argument.tag !== "NamedFunctionType")
                throw new ImpossibleError(`Calling pointer to non-function`);
            return kind.argument.returns;
        }
        case "CastExpression": {
            return concrete(genv, exp.kind);
        }
        case "UnaryExpression": {
            switch (exp.operator) {
                case "!":
                    return { tag: "BoolType" };
                case "&":
                    throw new ImpossibleError("Synthesizing type of a function pointer");
                case "~":
                case "-":
                    return { tag: "IntType" };
                case "*": {
                    const kind = recheck(genv, env, exp.argument);
                    if (kind.tag !== "PointerType") throw new ImpossibleError("Dereferencing non-pointer");
                    return kind.argument;
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
                case "|": return { tag: "IntType" }
                case "<":
                case "<=":
                case ">=":
                case ">":
                case "==":
                case "!=": return { tag: "BoolType" }
                default: return impossible(exp.operator);
            }
        }
        case "": {

        }
        default:
            return impossible(exp);
    }
}
