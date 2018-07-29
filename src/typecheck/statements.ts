import { impossible } from "@calculemus/impossible";
import * as ast from "../ast";
import { error } from "./error";
import { GlobalEnv } from "./globalenv";
import { Env, checkTypeInDeclaration, actualSynthed } from "./types";
import { checkExpression, synthExpression, synthLValue } from "./expressions";

export function checkStatements(
    genv: GlobalEnv,
    env: Env,
    stms: ast.Statement[],
    returning: ast.Type | null,
    inLoop: boolean
) {
    stms.forEach(stm => checkStatement(genv, env, stm, returning, inLoop));
}

function copyEnv(env: Env) {
    const envCopy = new Map<string, ast.Type>();
    env.forEach((v, k) => envCopy.set(k, v));
    return envCopy;
}

function checkStatement(
    genv: GlobalEnv,
    env: Env,
    stm: ast.Statement,
    returning: ast.Type | null,
    inLoop: boolean
): void {
    switch (stm.tag) {
        case "AssignmentStatement": {
            const left = synthLValue(genv, env, null, stm.left);
            checkExpression(genv, env, null, stm.right, left);
            return;
        }
        case "UpdateStatement": {
            checkExpression(genv, env, null, stm.argument, { tag: "IntType" });
            return;
        }
        case "ExpressionStatement": {
            const expType = actualSynthed(genv, synthExpression(genv, env, null, stm.expression));
            if (expType.tag === "StructType")
                return error(`expression used as statements cannot have type 'struct ${expType.id.name}'`);
            if (expType.tag === "NamedFunctionType")
                return error(
                    `expression used as statements cannot have function type '${expType.definition.id.name}'`
                );
            return;
        }
        case "VariableDeclaration": {
            checkTypeInDeclaration(genv, stm.kind);
            if (env.has(stm.id.name)) {
                return error(`variable '${stm.id.name}' declared twice`);
            } else if (stm.init !== null) {
                checkExpression(genv, env, null, stm.init, stm.kind);
            }
            env.set(stm.id.name, stm.kind);
            return;
        }
        case "IfStatement": {
            checkExpression(genv, env, null, stm.test, { tag: "BoolType" });
            checkStatement(genv, copyEnv(env), stm.consequent, returning, inLoop);
            if (stm.alternate) checkStatement(genv, copyEnv(env), stm.alternate, returning, inLoop);
            return;
        }
        case "WhileStatement": {
            checkExpression(genv, env, null, stm.test, { tag: "BoolType" });
            stm.invariants.forEach(anno =>
                checkExpression(genv, env, { tag: "@loop_invariant" }, anno, { tag: "BoolType" })
            );
            checkStatement(genv, copyEnv(env), stm.body, returning, true);
            return;
        }
        case "ForStatement": {
            const env0 = copyEnv(env);
            if (stm.init) checkStatement(genv, env0, stm.init, null, false);
            checkExpression(genv, env0, null, stm.test, { tag: "BoolType" });
            if (stm.update) checkStatement(genv, env0, stm.update, null, false);
            stm.invariants.forEach(anno =>
                checkExpression(genv, env0, { tag: "@loop_invariant" }, anno, { tag: "BoolType" })
            );
            checkStatement(genv, env0, stm.body, returning, true);
            return;
        }
        case "ReturnStatement": {
            if (returning === null) {
                return error(`return statements not allowed`);
            } else if (returning.tag === "VoidType") {
                if (stm.argument !== null) {
                    return error("function returning void must invoke 'return', not 'return e'");
                }
            } else {
                if (stm.argument === null) {
                    return error("type mismatch, expected a return type found void");
                } else {
                    checkExpression(genv, env, null, stm.argument, returning);
                }
            }
            return;
        }
        case "BlockStatement": {
            checkStatements(genv, copyEnv(env), stm.body, returning, inLoop);
            return;
        }
        case "AssertStatement": {
            checkExpression(genv, env, stm.contract ? { tag: "@assert" } : null, stm.test, {
                tag: "BoolType"
            });
            return;
        }
        case "ErrorStatement": {
            checkExpression(genv, env, null, stm.argument, { tag: "StringType" });
            return;
        }
        case "BreakStatement": {
            if (!inLoop)
                return error(
                    "break statement not allowed",
                    "break statements must be inside the body of a for-loop or while-loop"
                );
            return;
        }
        case "ContinueStatement": {
            if (!inLoop)
                return error(
                    "continue statement not allowed",
                    "continue statements must be inside the body of a for-loop or while-loop"
                );
            return;
        }
        default: {
            return impossible(stm);
        }
    }
}
