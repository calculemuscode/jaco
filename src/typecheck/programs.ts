import { impossible } from "@calculemus/impossible";
import { Map, List } from "immutable";
import * as ast from "../ast";
import { error } from "./error";
import { GlobalEnv } from "./globalenv";
import { Env, checkTypeInDeclaration, checkFunctionReturnType } from "./types";
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

function checkDeclarations(genv: GlobalEnv, decl: ast.Declaration) {
    switch (decl.tag) {
        case "Pragma": {
            return;
        }
        case "StructDeclaration": {
            return;
        }
        case "TypeDefinition": {
            return;
        }
        case "FunctionTypeDefinition": {
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
            return;
        }
        /* instanbul ignore next */
        default: {
            return impossible(decl as never);
        }
    }
}

export function check(decls: List<ast.Declaration | string>) {
    const checked: ast.Declaration[] = [];
    decls.forEach(decl => {
        if (typeof decl === "string") { console.log(decl); return; } 
        checkDeclarations(checked, decl);
        checked.push(decl);
    });
    return checked;
}
