import { impossible } from "@calculemus/impossible";
import { Set } from "immutable";
import * as ast from "../ast";
import { error } from "./error";
import { GlobalEnv } from "./globalenv";
import { Env, checkTypeInDeclaration } from "./types";
import { checkExpression, synthExpression, synthLValue, expressionFreeVars } from "./expressions";

export function checkStatements(
    genv: GlobalEnv,
    env: Env,
    stms: ast.Statement[],
    returning: ast.Type | null,
    inLoop: boolean
) {
    stms.reduce((env, stm) => checkStatement(genv, env, stm, returning, inLoop), env);
}

function checkStatement(
    genv: GlobalEnv,
    env: Env,
    stm: ast.Statement,
    returning: ast.Type | null,
    inLoop: boolean
): Env {
    switch (stm.tag) {
        case "AssignmentStatement": {
            const left = synthLValue(genv, env, null, stm.left);
            const right = checkExpression(genv, env, null, stm.right, left);
            left;
            right; // TODO bogus
            return env;
            /*
            if (left.tag === "AmbiguousNullPointer") {
                throw new Error(
                    "LValue cannot have ambiguous pointer type (should be impossible, please report)"
                );
            } else if (!isSubtype(genv, right, left)) {
                return error("sides of assignment have different type"); // TODO: types
            } else {
                return env;
            }
            */
        }
        case "UpdateStatement": {
            checkExpression(genv, env, null, stm.argument, { tag: "IntType" });
            return env;
        }
        case "ExpressionStatement": {
            synthExpression(genv, env, null, stm.expression);
            return env;
        }
        case "VariableDeclaration": {
            checkTypeInDeclaration(genv, stm.kind);
            if (env.has(stm.id.name)) {
                return error(`variable '${stm.id.name}' declared twice`);
            } else if (stm.init !== null) {
                checkExpression(genv, env, null, stm.init, stm.kind);
            }
            return env.set(stm.id.name, stm.kind);
        }
        case "IfStatement": {
            checkExpression(genv, env, null, stm.test, { tag: "BoolType" });
            checkStatement(genv, env, stm.consequent, returning, inLoop);
            if (stm.alternate) checkStatement(genv, env, stm.alternate, returning, inLoop);
            return env;
        }
        case "WhileStatement": {
            checkExpression(genv, env, null, stm.test, { tag: "BoolType" });
            stm.invariants.forEach(anno =>
                checkExpression(genv, env, { tag: "@loop_invariant" }, anno, { tag: "BoolType" })
            );
            checkStatement(genv, env, stm.body, returning, true);
            return env;
        }
        case "ForStatement": {
            const env0 = stm.init ? checkStatement(genv, env, stm.init, null, false) : env;
            checkExpression(genv, env0, null, stm.test, { tag: "BoolType" });
            if (stm.update) checkStatement(genv, env0, stm.update, null, false);
            stm.invariants.forEach(anno =>
                checkExpression(genv, env0, { tag: "@loop_invariant" }, anno, { tag: "BoolType" })
            );
            checkStatement(genv, env0, stm.body, returning, true);
            return env;
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
                    return error("type mismatch, expected a return type found void"); // TODO types
                } else {
                    checkExpression(genv, env, null, stm.argument, returning);
                }
            }
            return env;
        }
        case "BlockStatement": {
            checkStatements(genv, env, stm.body, returning, inLoop);
            return env;
        }
        case "AssertStatement": {
            checkExpression(genv, env, stm.contract ? { tag: "@assert" } : null, stm.test, {
                tag: "BoolType"
            });
            return env;
        }
        case "ErrorStatement": {
            checkExpression(genv, env, null, stm.argument, { tag: "StringType" });
            return env;
        }
        case "BreakStatement": {
            if (!inLoop)
                return error(
                    "break statement not allowed",
                    "break statements must be inside the body of a for-loop or while-loop"
                );
            return env;
        }
        case "ContinueStatement": {
            if (!inLoop)
                return error(
                    "continue statement not allowed",
                    "continue statements must be inside the body of a for-loop or while-loop"
                );
            return env;
        }
        default: {
            return impossible(stm);
        }
    }
}

function checkExpressionUses(locals: Set<string>, defined: Set<string>, exp: ast.Expression): Set<string> {
    const freeVars = expressionFreeVars(exp);
    const freeLocals = freeVars.intersect(locals);
    const undefinedFreeLocals = freeLocals.subtract(defined);
    for (let badLocal in undefinedFreeLocals.values) {
        return error(`local ${badLocal} used without necessarily being defined`);
    }
    return freeVars.subtract(locals);
}

/**
 * 
 * @param locals All locals valid at this point in the program
 * @param constants Locals that are free in the postcondition and so must not be modified
 * @param defined Locals that have been previously defined on all control paths to this point
 * @param stm The statement being analyized
 */
export function checkStatementFlow(locals: Set<string>, constants: Set<string>, defined: Set<string>, stm: ast.Statement): {locals: Set<string>, defined: Set<string>, functions: Set<string>} {
    switch(stm.tag) {
        case "AssignmentStatement": {
            let functions = checkExpressionUses(locals, defined, stm.right);
            if (stm.left.tag === "Identifier") {
                if (constants.has(stm.left.name)) {
                    error(`assigning to ${stm.left.name} is not permitted when ${stm.left.name} is used in postcondition`);
                }
                defined = defined.add(stm.left.name);
            } else {
                functions = functions.union(checkExpressionUses(locals, defined, stm.left));
            }
            return { locals: locals, defined: defined, functions: functions };
        }
        case "UpdateStatement": {
            return { locals: locals, defined: defined, functions: checkExpressionUses(locals, defined, stm.argument) };
        }
        case "ExpressionStatement": {
            return { locals: locals, defined: defined, functions: checkExpressionUses(locals, defined, stm.expression) };
        }
        case "VariableDeclaration": {
            if (stm.init === null) return { locals: locals.add(stm.id.name), defined: defined, functions: Set() };
            return { locals: locals.add(stm.id.name), defined: defined.add(stm.id.name), functions: checkExpressionUses(locals, defined, stm.init)};
        }
        case "IfStatement": {
            const test = checkExpressionUses(locals, defined, stm.test);
            const consequent = checkStatementFlow(locals, constants, defined, stm.consequent);
            if (stm.alternate) {
                const alternate = checkStatementFlow(locals, constants, defined, stm.alternate);
                return { locals: locals, defined: consequent.defined.intersect(alternate.defined), functions: test.union(consequent.functions).union(alternate.functions)};
            } else {
                return { locals: locals, defined: defined, functions: test.union(consequent.functions)};
            }
        }
        case "WhileStatement": {
            //const test = checkExpression
        }
        default:
        return error("unimplemented"); //impossible(stm);
    }
}

