import { impossible } from "@calculemus/impossible";
import { Map, List } from "immutable";
import * as ast from "../ast";
import { error } from "./error";
import { GlobalEnv, getTypeDef, getFunctionDeclaration } from "./globalenv";
import { Env, equalFunctionTypes, checkTypeInDeclaration, checkFunctionReturnType } from "./types";
import { checkExpression } from "./expressions";
import { checkStatements } from "./statements";

function getEnvironmentFromParams(genv: GlobalEnv, params: ast.VariableDeclarationOnly[]): Env {
    return params.reduce((env, param) => {
        checkTypeInDeclaration(genv, param.kind, true);
        if (env.has(param.id.name)) {
            return error(`variable ${param.id.name} declared twice`);
        } else {
            return env.set(param.id.name, param.kind);
        }
    }, Map<string, ast.Type>());
}

function checkDeclaration(genv: GlobalEnv, decl: ast.Declaration) {
    switch (decl.tag) {
        case "Pragma": {
            return;
        }
        case "StructDeclaration": {
            return;
        }
        case "TypeDefinition":
        case "FunctionTypeDefinition": {
            const typeoftype = decl.tag === "TypeDefinition" ? "type" : "function type";
            const previousTypeDef = getTypeDef(genv, decl.definition.id.name);
            const previousFunction = getFunctionDeclaration(genv, decl.definition.id.name);
            if (previousTypeDef !== null)
                return error(`${typeoftype} name '${decl.definition.id.name}' already defined as a type`);
            if (previousFunction !== null)
                return error(
                    `${typeoftype} name '${decl.definition.id.name}' already used in a function ${
                        previousFunction.body === null ? "declaration" : "definition"
                    }`
                );
            return;
        }
        case "FunctionDeclaration": {
            checkFunctionReturnType(genv, decl.returns);
            const env = getEnvironmentFromParams(genv, decl.params);
            decl.preconditions.forEach(anno =>
                checkExpression(genv, env, { tag: "@requires" }, anno, { tag: "BoolType" })
            );
            decl.postconditions.forEach(anno =>
                checkExpression(genv, env, { tag: "@ensures", returns: decl.returns }, anno, {
                    tag: "BoolType"
                })
            );

            if (decl.body !== null) {
                checkStatements(genv, env, decl.body.body, decl.returns, false);
            }

            const previousFunction = getFunctionDeclaration(genv, decl.id.name);
            if (previousFunction === null) return;
            if (previousFunction.body !== null && decl.body !== null)
                error(`function ${decl.id.name} defined more than once`);
            if (!equalFunctionTypes(genv, previousFunction, decl)) {
                const oldone = previousFunction.body === null ? "declaration" : "definition";
                const newone = decl.body === null ? "declaration" : "definition";
                error(`function ${newone} for '${decl.id.name}' does not match previous function ${oldone}`);
            }

            return;
        }
        /* instanbul ignore next */
        default: {
            return impossible(decl as never);
        }
    }
}

export function check(decls: List<ast.Declaration>) {
    const checked: ast.Declaration[] = [{
        tag: "FunctionDeclaration",
        returns: { tag: "IntType" },
        id: { tag: "Identifier", name: "main" },
        params: [],
        preconditions: [],
        postconditions: [],
        body: null
    }];
    decls.forEach(decl => {
        checkDeclaration(checked, decl);
        checked.push(decl);
    });
    return checked;
}
