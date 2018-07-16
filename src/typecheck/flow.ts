import { impossible } from "@calculemus/impossible";
import { Set } from "immutable";
import * as ast from "../ast";
import { error } from "./error";

/**
 * Returns the free locals and free functions of an expression. (The type system ensures these are 
 * disjoint within any top-level declaration.)
 */
export function expressionFreeVars(exp: ast.Expression): Set<string> {
    switch (exp.tag) {
        case "Identifier":
            return Set([exp.name]);
        case "IntLiteral":
        case "StringLiteral":
        case "CharLiteral":
        case "BoolLiteral":
        case "NullLiteral":
        case "AllocExpression":
        case "ResultExpression":
            return Set();
        case "ArrayMemberExpression":
            return expressionFreeVars(exp.object).union(expressionFreeVars(exp.index));
        case "StructMemberExpression":
            return expressionFreeVars(exp.object);
        case "CallExpression":
        case "IndirectCallExpression":
            return exp.arguments.reduce(
                (fv, arg) => fv.union(expressionFreeVars(arg)),
                expressionFreeVars(exp.callee)
            );
        case "UnaryExpression":
        case "CastExpression":
        case "LengthExpression":
        case "HasTagExpression":
            return expressionFreeVars(exp.argument);
        case "BinaryExpression":
        case "LogicalExpression":
            return expressionFreeVars(exp.left).union(expressionFreeVars(exp.right));
        case "ConditionalExpression":
            return expressionFreeVars(exp.test)
                .union(expressionFreeVars(exp.consequent))
                .union(expressionFreeVars(exp.alternate));
        case "AllocArrayExpression":
            return expressionFreeVars(exp.size);
        default:
            return impossible(exp);
    }
}

/**
 * Ensures that the free locals of an expression have been defined along every control path
 * Raises an error if there are potentially un-initialized stack locals
 *  - Precondition: the expression must have passed typechecking
 *  - Precondition: all the current stack locals must be in [locals]
 *  - Precondition: [defined] is the subset of [locals] defined on every 
 *  - Returns the free functions (the free locals that are not stack-allocated locals)
 */
export function checkExpressionUsesGetFreeFunctions(locals: Set<string>, defined: Set<string>, exp: ast.Expression): Set<string> {
    const freeVars = expressionFreeVars(exp);
    const freeLocals = freeVars.intersect(locals);
    const undefinedFreeLocals = freeLocals.subtract(defined);
    for (let badLocal of undefinedFreeLocals.values()) {
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
 * @returns 
 *   - locals: locals valid after running this statement (changes when the statement is a declaration)
 *   - defined: definitely-defined locals after running this statement
 *   - functions: free functions in this statement
 *   - returns: does 
 */
export function checkStatementFlow(
    locals: Set<string>,
    constants: Set<string>,
    defined: Set<string>,
    stm: ast.Statement
): { locals: Set<string>; defined: Set<string>; functions: Set<string>; returns: boolean } {
    switch (stm.tag) {
        case "AssignmentStatement": {
            let functions = checkExpressionUsesGetFreeFunctions(locals, defined, stm.right);
            if (stm.left.tag === "Identifier") {
                if (constants.has(stm.left.name)) {
                    error(
                        `assigning to ${stm.left.name} is not permitted when ${
                            stm.left.name
                        } is used in postcondition`
                    );
                }
                defined = defined.add(stm.left.name);
            } else {
                functions = functions.union(checkExpressionUsesGetFreeFunctions(locals, defined, stm.left));
            }
            return { locals: locals, defined: defined, functions: functions, returns: false };
        }
        case "UpdateStatement": {
            return {
                locals: locals,
                defined: defined,
                functions: checkExpressionUsesGetFreeFunctions(locals, defined, stm.argument),
                returns: false
            };
        }
        case "ExpressionStatement": {
            return {
                locals: locals,
                defined: defined,
                functions: checkExpressionUsesGetFreeFunctions(locals, defined, stm.expression),
                returns: false
            };
        }
        case "VariableDeclaration": {
            if (stm.init === null)
                return { locals: locals.add(stm.id.name), defined: defined, functions: Set(), returns: false };
            return {
                locals: locals.add(stm.id.name),
                defined: defined.add(stm.id.name),
                functions: checkExpressionUsesGetFreeFunctions(locals, defined, stm.init),
                returns: false
            };
        }
        case "IfStatement": {
            const test = checkExpressionUsesGetFreeFunctions(locals, defined, stm.test);
            const consequent = checkStatementFlow(locals, constants, defined, stm.consequent);
            if (stm.alternate) {
                const alternate = checkStatementFlow(locals, constants, defined, stm.alternate);
                return {
                    locals: locals,
                    defined: consequent.defined.intersect(alternate.defined),
                    functions: test.union(consequent.functions).union(alternate.functions),
                    returns: consequent.returns && alternate.returns
                };
            } else {
                return { locals: locals, defined: defined, functions: test.union(consequent.functions), returns: false };
            }
        }
        case "WhileStatement": {
            const test = stm.invariants.reduce(
                (set, exp) => set.union(checkExpressionUsesGetFreeFunctions(locals, defined, exp)),
                checkExpressionUsesGetFreeFunctions(locals, defined, stm.test)
            );
            const body = checkStatementFlow(locals, constants, defined, stm.body);
            return { locals: locals, defined: defined, functions: test.union(body.functions), returns: false };
        }
        case "ForStatement": {
            const init = checkStatementFlow(
                locals,
                constants,
                defined,
                stm.init || { tag: "BlockStatement", body: [] }
            );
            const test = stm.invariants.reduce(
                (set, exp) => set.union(checkExpressionUsesGetFreeFunctions(init.locals, init.defined, exp)),
                checkExpressionUsesGetFreeFunctions(init.locals, init.defined, stm.test)
            );
            const body = checkStatementFlow(init.locals, constants, init.defined, stm.body);
            const update = checkStatementFlow(
                init.locals,
                constants,
                body.defined,
                stm.update || { tag: "BlockStatement", body: [] }
            );
            return {
                locals: locals,
                defined: init.defined,
                functions: init.functions
                    .union(test)
                    .union(body.functions)
                    .union(update.functions), returns: false
            };
        }
        case "ReturnStatement": {
            return {
                locals: locals,
                defined: locals,
                functions: stm.argument === null ? Set() : checkExpressionUsesGetFreeFunctions(locals, defined, stm.argument), returns: true
            };
        }
        case "BlockStatement": {
            const body = stm.body.reduce(
                ({ locals, defined, functions, returns }, stm) => {
                    const result = checkStatementFlow(locals, constants, defined, stm);
                    return {
                        locals: result.locals,
                        defined: result.defined,
                        functions: functions.union(result.functions),
                        returns: returns || result.returns
                    };
                },
                { locals: locals, defined: defined, functions: Set(), returns: false }
            );
            return {
                locals: locals,
                defined: body.defined,
                functions: body.functions,
                returns: body.returns
            };
        }
        case "AssertStatement": {
            return {
                locals: locals,
                defined: defined,
                functions: checkExpressionUsesGetFreeFunctions(locals, defined, stm.test),
                returns: false
            };
        }
        case "ErrorStatement": {
            return {
                locals: locals,
                defined: defined,
                functions: checkExpressionUsesGetFreeFunctions(locals, defined, stm.argument),
                returns: true
            }
        }
        case "BreakStatement":
        case "ContinueStatement": {
            return { locals: locals, defined: locals, functions: Set(), returns: false };
        }
        default:
            return impossible(stm);
    }
}
