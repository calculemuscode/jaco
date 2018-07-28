import { impossible } from "@calculemus/impossible";
import * as ast from "../ast";
import { error } from "./error";
import {
    GlobalEnv,
    getTypeDef,
    getFunctionDeclaration,
    addDecl,
    initMain,
    isLibraryFunction,
    isLibraryStruct,
    getStructDefinition
} from "./globalenv";
import {
    Env,
    equalFunctionTypes,
    checkTypeInDeclaration,
    checkFunctionReturnType,
    typeSizeFullyDefined
} from "./types";
import { checkExpression } from "./expressions";
import { checkStatements } from "./statements";
import { expressionFreeVars, checkStatementFlow, checkExpressionUsesGetFreeFunctions } from "./flow";

function getDefinedFromParams(params: ast.VariableDeclarationOnly[]): Set<string> {
    return params.reduce((set, param) => set.add(param.id.name), new Set<string>());
}

function getEnvironmentFromParams(genv: GlobalEnv, params: ast.VariableDeclarationOnly[]): Env {
    return params.reduce((env, param) => {
        checkTypeInDeclaration(genv, param.kind, true);
        if (env.has(param.id.name)) {
            return error(`variable ${param.id.name} declared twice`);
        } else {
            return env.set(param.id.name, param.kind);
        }
    }, new Map<string, ast.Type>());
}

function checkDeclaration(library: boolean, genv: GlobalEnv, decl: ast.Declaration): Set<string> {
    switch (decl.tag) {
        case "Pragma": {
            return new Set();
        }
        case "StructDeclaration": {
            if (decl.definitions === null) return new Set();
            if (!library && isLibraryStruct(genv, decl.id.name))
                return error(`struct ${decl.id.name} is declared in a library and cannot be defined here`);
            const previousStruct = getStructDefinition(genv, decl.id.name);
            if (previousStruct !== null && previousStruct.definitions !== null)
                return error(`struct ${decl.id.name} is defined twice`, "structs can only be defined once");
            decl.definitions.reduce((set, definition) => {
                if (set.has(definition.id.name))
                    error(
                        `field '${definition.id.name}' used more than once in definition of struct '${
                            decl.id.name
                        }'`
                    );
                const undefinedTypePart = typeSizeFullyDefined(genv, definition.kind);
                if (undefinedTypePart !== null) {
                    return error(
                        `cannot define struct ${
                            decl.id.name
                        } because component struct ${undefinedTypePart} is not fully defined`
                    );
                }
                return set.add(definition.id.name);
            }, new Set<string>());
            return new Set();
        }
        case "TypeDefinition": {
            const previousTypeDef = getTypeDef(genv, decl.definition.id.name);
            const previousFunction = getFunctionDeclaration(genv, decl.definition.id.name);
            if (previousTypeDef !== null)
                return error(`type name '${decl.definition.id.name}' already defined as a type`);
            if (previousFunction !== null)
                return error(
                    `type name '${decl.definition.id.name}' already used in a function ${
                        previousFunction.body === null ? "declaration" : "definition"
                    }`
                );
            return new Set();
        }
        case "FunctionTypeDefinition": {
            const previousTypeDef = getTypeDef(genv, decl.definition.id.name);
            const previousFunction = getFunctionDeclaration(genv, decl.definition.id.name);
            if (previousTypeDef !== null)
                return error(`function type name '${decl.definition.id.name}' already defined as a type`);
            if (previousFunction !== null)
                return error(
                    `function type name '${decl.definition.id.name}' already used in a function ${
                        previousFunction.body === null ? "declaration" : "definition"
                    }`
                );
            checkFunctionReturnType(genv, decl.definition.returns);
            const env = getEnvironmentFromParams(genv, decl.definition.params);
            const defined = getDefinedFromParams(decl.definition.params);
            let functionsUsed = decl.definition.preconditions.reduce(
                (functionsUsed, anno) => {
                    checkExpression(genv, env, { tag: "@requires" }, anno, { tag: "BoolType" });
                    const freeFunctions = checkExpressionUsesGetFreeFunctions(defined, defined, anno);
                    functionsUsed.forEach(x => freeFunctions.add(x));
                    return freeFunctions;
                },
                decl.definition.postconditions.reduce((functionsUsed, anno) => {
                    checkExpression(genv, env, { tag: "@ensures", returns: decl.definition.returns }, anno, {
                        tag: "BoolType"
                    });
                    const freeFunctions = checkExpressionUsesGetFreeFunctions(defined, defined, anno); 
                    functionsUsed.forEach(x => freeFunctions.add(x));
                    return freeFunctions;
                }, new Set())
            );
            return functionsUsed;
        }
        case "FunctionDeclaration": {
            checkFunctionReturnType(genv, decl.returns);
            const env = getEnvironmentFromParams(genv, decl.params);
            const defined = getDefinedFromParams(decl.params);
            let functionsUsed = decl.preconditions.reduce(
                (functionsUsed, anno) => {
                    checkExpression(genv, env, { tag: "@requires" }, anno, { tag: "BoolType" });
                    const freeFunctions = checkExpressionUsesGetFreeFunctions(defined, defined, anno);
                    functionsUsed.forEach(x => freeFunctions.add(x));
                    return freeFunctions;
                },
                decl.postconditions.reduce((functionsUsed, anno) => {
                    checkExpression(genv, env, { tag: "@ensures", returns: decl.returns }, anno, {
                        tag: "BoolType"
                    });
                    const freeFunctions = checkExpressionUsesGetFreeFunctions(defined, defined, anno);
                    functionsUsed.forEach(x => freeFunctions.add(x));
                    return freeFunctions;
                }, new Set())
            );

            const previousFunction = getFunctionDeclaration(genv, decl.id.name);
            if (previousFunction !== null) {
                if (previousFunction.body !== null && decl.body !== null)
                    error(`function ${decl.id.name} defined more than once`);
                if (!equalFunctionTypes(genv, previousFunction, decl)) {
                    const oldone = previousFunction.body === null ? "declaration" : "definition";
                    const newone = decl.body === null ? "declaration" : "definition";
                    error(
                        `function ${newone} for '${decl.id.name}' does not match previous function ${oldone}`
                    );
                }
            }

            if (decl.body !== null) {
                if (library) error(`functions cannot be defined in a library header file`);
                if (isLibraryFunction(genv, decl.id.name))
                    error(`function ${decl.id.name} is declared in a library header and cannot be defined`);
                addDecl(false, genv, {
                    tag: "FunctionDeclaration",
                    id: decl.id,
                    returns: decl.returns,
                    params: decl.params,
                    preconditions: [],
                    postconditions: [],
                    body: null
                });
                checkStatements(genv, env, decl.body.body, decl.returns, false);
                let constants = new Set();
                decl.postconditions.forEach(anno => {
                        expressionFreeVars(anno).forEach(x => {
                            if (defined.has(x)) constants.add(x);
                        })
                    }
                );
                const functionAnalysis = checkStatementFlow(defined, constants, defined, decl.body);
                if (decl.returns.tag !== "VoidType" && !functionAnalysis.returns)
                    return error(
                        `function ${
                            decl.id.name
                        } has non-void return type but does not return along every path`
                    );
                functionAnalysis.functions.forEach(f => functionsUsed.add(f));
            }

            return functionsUsed;
        }
        /* instanbul ignore next */
        default: {
            return impossible(decl as never);
        }
    }
}

export function checkProgram(libs: ast.Declaration[], decls: ast.Declaration[]) {
    const genv = initMain();
    const functionsUsed = new Set<string>();
    libs.forEach(decl => {
        checkDeclaration(true, genv, decl).forEach(f => functionsUsed.add(f))
        addDecl(true, genv, decl);
    });
    decls.forEach((decl) => {
        checkDeclaration(false, genv, decl).forEach(f => functionsUsed.add(f));
        addDecl(false, genv, decl)
    });

    functionsUsed.add("main");
    functionsUsed.forEach((name): void => {
        const def = getFunctionDeclaration(genv, name);
        if (def === null) return error(`No definition for ${name} (should be impossible, please report)`);
        if (def.body === null && !isLibraryFunction(genv, def.id.name))
            return error(`function ${name} is never defined`);
    });
}
