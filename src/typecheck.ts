import * as ast from "./ast";
import { Map, List } from "immutable";
import { impossible } from "@calculemus/impossible";
import { GlobalEnv, expandTypeDef } from "./typecheck/globalenv";

type Env = Map<string, ast.Type>;
type mode =
    | null
    | { tag: "@requires" }
    | { tag: "@ensures"; returns: ast.Type }
    | { tag: "@loop_invariant" }
    | { tag: "@assert" };

function error(s1: string, s2?: string): never {
    if (s2 === undefined) throw new Error(s1);
    throw new Error(`${s1}\n[Hint: ${s2}]`);
}

function checkTypeIsNotVoid(genv: GlobalEnv, t: ast.Type): void {
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
function checkTypeInDeclaration(genv: GlobalEnv, tp: ast.Type, isFunctionArg?: boolean): void {
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

/** Asserts that a synthesized type has small type */
function synthSmallExpression(
    genv: GlobalEnv,
    env: Env,
    mode: mode,
    exp: ast.Expression,
    place: string
): Synthed {
    let tp = synthExpression(genv, env, mode, exp);
    if (tp.tag === "Identifier") tp = expandTypeDef(genv, tp);
    switch (tp.tag) {
        case "StructType": {
            return error(
                `expression has struct type`,
                `a ${place} cannot contain structs; consider using pointers`
            ); // todo name type
        }
        default:
            return tp;
    }
}

function checkFunctionReturnType(genv: GlobalEnv, t: ast.Type) {
    switch (t.tag) {
        case "VoidType":
            return;
        default:
            return checkTypeInDeclaration(genv, t, true);
    }
}

type Synthed = ast.Type | { tag: "AmbiguousPointer" };

function isSubtype(genv: GlobalEnv, abstract: Synthed, concrete: ast.Type): boolean {
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

function synthExpression(genv: GlobalEnv, env: Env, mode: mode, exp: ast.Expression): Synthed {
    switch (exp.tag) {
        case "Identifier": {
            const t = env.get(exp.name);
            if (t === undefined) {
                return error(`Undeclared variable ${exp.tag}`);
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
            return { tag: "AmbiguousPointer" };
        case "ArrayMemberExpression": {
            const objectType = synthExpression(genv, env, mode, exp.object);
            if (objectType.tag !== "ArrayType") {
                return error("subject of indexing '[...]' not an array"); // TODO: "inferred type t1"
            } else {
                checkExpression(genv, env, mode, exp.index, { tag: "IntType" });
                return objectType.argument;
            }
        }
        case "StructMemberExpression": {
            return { tag: "IntType" }; // Bogus
        }
        case "CallExpression": {
            return { tag: "IntType" }; // Bogus
        }
        case "IndirectCallExpression": {
            return { tag: "IntType" }; // Bogus
        }
        case "CastExpression": {
            return { tag: "IntType" }; // Bogus
        }
        case "UnaryExpression": {
            switch (exp.operator) {
                case "!": {
                    checkExpression(genv, env, mode, exp.argument, { tag: "BoolType" });
                    return { tag: "BoolType" };
                }
                case "&":
                case "~":
                case "-": {
                    checkExpression(genv, env, mode, exp.argument, { tag: "IntType" });
                    return { tag: "IntType" };
                }
                case "*": {
                    const tp = synthExpression(genv, env, mode, exp.argument);
                    switch (tp.tag) {
                        case "AmbiguousPointer":
                            return error("cannot dereference NULL");
                        case "PointerType": {
                            if (tp.argument.tag === "VoidType") {
                                return error(
                                    "cannot dereference value of type 'void*'",
                                    "cast to another pointer type with '(t*)'"
                                );
                            } else {
                                return tp.argument;
                            }
                        }
                        default:
                            return error("subject of '*' not a pointer"); // TODO: inferred type
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
                    checkExpression(genv, env, mode, exp.left, { tag: "IntType" });
                    return { tag: "IntType" };
                }

                case "<":
                case "<=":
                case ">=":
                case ">": {
                    checkExpression(genv, env, mode, exp.left, { tag: "IntType" });
                    checkExpression(genv, env, mode, exp.left, { tag: "IntType" });
                    return { tag: "BoolType" };
                }

                case "==":
                case "!=": {
                    const left = synthExpression(genv, env, mode, exp.left);
                    const right = synthExpression(genv, env, mode, exp.right);
                    left;
                    right;
                    return { tag: "BoolType" }; // Bogus
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
            right;
            return left; // Bogus
        }
        case "AllocExpression": {
            // TODO check type
            return { tag: "PointerType", argument: exp.kind };
        }
        case "AllocArrayExpression": {
            // TODO check type
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

function checkExpression(genv: GlobalEnv, env: Env, mode: mode, exp: ast.Expression, tp: ast.Type): void {
    const synthed = synthExpression(genv, env, mode, exp);
    if (!isSubtype(genv, synthed, tp)) {
        console.log(synthed);
        console.log(tp);
        console.log(exp);
        return error("type mismatch"); // TODO: expected/found
    }
}

function checkStatements(genv: GlobalEnv, env: Env, stms: ast.Statement[], returning: ast.Type | null, inLoop: boolean) {
    stms.reduce((env, stm) => 
         checkStatement(genv, env, stm, returning, inLoop)
    , env)
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
            const left = synthExpression(genv, env, null, stm.left);
            const right = synthSmallExpression(genv, env, null, stm.right, "assignment statement");
            /* istanbul ignore if */
            if (left.tag === "AmbiguousPointer") {
                throw new Error(
                    "LValue cannot have ambiguous pointer type (should be impossible, please report)"
                );
            } else if (!isSubtype(genv, right, left)) {
                return error("sides of assignment have different type"); // TODO: types
            } else {
                return env;
            }
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
            // xxx fix
            const env0 = stm.init ? checkStatement(genv, env, stm.init, null, false) : env;
            checkExpression(genv, env0, null, stm.test, { tag: "BoolType" });
            if (stm.update) checkStatement(genv, env0, stm.update, null, false);
            stm.invariants.forEach(anno => checkExpression(genv, env, { tag: "@loop_invariant" }, anno, { tag: "BoolType" }));
            checkStatement(genv, env, stm.body, returning, true);            
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
            checkExpression(genv, env, stm.contract ? { tag: "@assert" } : null, stm.test, { tag: "BoolType" });
            return env;
        }
        case "ErrorStatement": {
            checkExpression(genv, env, null, stm.argument, { tag: "StringType" });
            return env;
        }
        case "BreakStatement": {
            if (!inLoop) return error("break statement not allowed", "break statements must be inside the body of a for-loop or while-loop");
            return env;
        }
        case "ContinueStatement": {
            if (!inLoop) return error("continue statement not allowed", "continue statements must be inside the body of a for-loop or while-loop");
            return env;
        }
        default: {
            stm;
            return env;
        }
    }
}

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
        if (typeof decl === "string") return;
        checkDeclarations(checked, decl);
        checked.push(decl);
    });
    return checked;
}
