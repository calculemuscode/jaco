import * as ast from "../ast";
import { Instruction, instructionToString, Function, Program } from "./high-level";
import { ImpossibleError } from "../error";
import { impossible } from "@calculemus/impossible";
import { computeStructMap } from "../typecheck/structs";

function load(kind: ast.ConcreteType): Instruction {
    switch (kind.tag) {
        case "BoolType":
            return { tag: "BMLOAD" };
        case "CharType":
            return { tag: "CMLOAD" };
        case "IntType":
            return { tag: "IMLOAD" };
        case "StringType":
            return { tag: "SMLOAD" };
        case "ArrayType":
        case "PointerType":
        case "TaggedPointerType":
            return { tag: "AMLOAD" };
        /* istanbul ignore next */
        default:
            throw new ImpossibleError(`load: ${kind.tag}`);
    }
}

function store(kind: ast.ConcreteType): Instruction {
    switch (kind.tag) {
        case "BoolType":
            return { tag: "BMSTORE" };
        case "CharType":
            return { tag: "CMSTORE" };
        case "IntType":
            return { tag: "IMSTORE" };
        case "StringType":
            return { tag: "SMSTORE" };
        case "ArrayType":
        case "PointerType":
        case "TaggedPointerType":
            return { tag: "AMSTORE" };
        /* istanbul ignore next */
        default:
            throw new ImpossibleError(`store: ${kind.tag}`);
    }
}

/**
 * Input: Well-typed Boolean expression
 * Output: Instruction sequence that jumps unconditionally to ifTrue or ifFalse
 */
function conditional(exp: ast.Expression, ifTrue: string, ifFalse: string): Instruction[] {
    switch (exp.tag) {
        case "UnaryExpression": {
            if (exp.operator === "!") return conditional(exp.argument, ifFalse, ifTrue);
            break;
        }
        case "BinaryExpression": {
            // Handles NULL === NULL
            // XXX BUG: also catches &f === &g
            if (!exp.size) return [{ tag: "GOTO", argument: exp.operator === "==" ? ifTrue : ifFalse }];

            const left = expression(exp.left);
            const right = expression(exp.right);
            const instrs = left.concat(right);
            const gotoTrue: Instruction = { tag: "GOTO", argument: ifTrue };
            const gotoFalse: Instruction = { tag: "GOTO", argument: ifFalse };
            switch (exp.size.tag) {
                case "BoolType": {
                    if (exp.operator === "==")
                        return instrs.concat([{ tag: "IF_BCMPEQ", argument: ifTrue }, gotoFalse]);
                    else return instrs.concat([{ tag: "IF_BCMPEQ", argument: ifFalse }, gotoTrue]);
                }

                case "ArrayType":
                case "PointerType": {
                    if (exp.operator === "==")
                        return instrs.concat([{ tag: "IF_ACMPEQ", argument: ifTrue }, gotoFalse]);
                    else return instrs.concat([{ tag: "IF_ACMPEQ", argument: ifFalse }, gotoTrue]);
                }

                case "TaggedPointerType": {
                    if (exp.operator === "==")
                        return left
                            .concat([{ tag: "UNTAG" }])
                            .concat(right)
                            .concat([{ tag: "UNTAG" }])
                            .concat([{ tag: "IF_ACMPEQ", argument: ifTrue }])
                            .concat([gotoFalse]);
                    else
                        return left
                            .concat([{ tag: "UNTAG" }])
                            .concat(right)
                            .concat([{ tag: "UNTAG" }])
                            .concat([{ tag: "IF_ACMPEQ", argument: ifFalse }])
                            .concat([gotoTrue]);
                }

                case "CharType": {
                    switch (exp.operator) {
                        case "<":
                            return instrs.concat([{ tag: "IF_CCMPLT", argument: ifTrue }, gotoFalse]);
                        case ">=":
                            return instrs.concat([{ tag: "IF_CCMPLT", argument: ifFalse }, gotoTrue]);
                        case "<=":
                            return instrs.concat([{ tag: "IF_CCMPLE", argument: ifTrue }, gotoFalse]);
                        case ">":
                            return instrs.concat([{ tag: "IF_CCMPLE", argument: ifFalse }, gotoTrue]);
                        case "==":
                            return instrs.concat([{ tag: "IF_CCMPEQ", argument: ifTrue }, gotoFalse]);
                        case "!=":
                            return instrs.concat([{ tag: "IF_CCMPEQ", argument: ifFalse }, gotoTrue]);
                        /* istanbul ignore next */
                        default:
                            throw new ImpossibleError(
                                `conditional() given non-bool BinaryExpression ${exp.operator} comparing char`
                            );
                    }
                }

                case "IntType": {
                    switch (exp.operator) {
                        case "<":
                            return instrs.concat([{ tag: "IF_ICMPLT", argument: ifTrue }, gotoFalse]);
                        case ">=":
                            return instrs.concat([{ tag: "IF_ICMPLT", argument: ifFalse }, gotoTrue]);
                        case "<=":
                            return instrs.concat([{ tag: "IF_ICMPLE", argument: ifTrue }, gotoFalse]);
                        case ">":
                            return instrs.concat([{ tag: "IF_ICMPLE", argument: ifFalse }, gotoTrue]);
                        case "==":
                            return instrs.concat([{ tag: "IF_ICMPEQ", argument: ifTrue }, gotoFalse]);
                        case "!=":
                            return instrs.concat([{ tag: "IF_ICMPEQ", argument: ifFalse }, gotoTrue]);
                        /* istanbul ignore next */
                        default:
                            throw new ImpossibleError(
                                `conditional() given non-bool BinaryExpression ${exp.operator} comparing ints`
                            );
                    }
                }

                /* istanbul ignore next */
                default:
                    throw new ImpossibleError(
                        `conditional() given BinaryExpression comparing ${exp.size.tag}`
                    );
            }
        }
        case "LogicalExpression": {
            const labelMid = label("mid");
            if (exp.operator === "&&")
                return conditional(exp.left, labelMid, ifFalse)
                    .concat([{ tag: "LABEL", argument: labelMid }])
                    .concat(conditional(exp.right, ifTrue, ifFalse));
            else
                return conditional(exp.left, ifTrue, labelMid)
                    .concat([{ tag: "LABEL", argument: labelMid }])
                    .concat(conditional(exp.right, ifTrue, ifFalse));
        }
        case "HasTagExpression": {
            return expression(exp.argument)
                .concat([{ tag: "IF_TAGEQ", cast: exp.typename!, argument: ifTrue }])
                .concat([{ tag: "GOTO", argument: ifFalse }]);
        }
    }

    // Give-up instruction: put the boolean on the stack
    // (example: an identifier or bool-returning function)
    return expression(exp).concat([{ tag: "IF", argument: ifTrue }, { tag: "GOTO", argument: ifFalse }]);
}

function conditionalexpression(exp: ast.Expression) {
    const labelTrue = label("true");
    const labelFalse = label("false");
    const labelEnd = label("end");
    const instrs = conditional(exp, labelTrue, labelFalse);
    return instrs.concat([
        { tag: "LABEL", argument: labelTrue },
        { tag: "BPUSH", argument: true },
        { tag: "GOTO", argument: labelEnd },
        { tag: "LABEL", argument: labelFalse },
        { tag: "BPUSH", argument: false },
        { tag: "LABEL", argument: labelEnd }
    ]);
}

// From A[i], get  S --> S, &A[i]
function arrayMemberExpression(exp: ast.ArrayMemberExpression) {
    return expression(exp.object)
        .concat(expression(exp.index))
        .concat([{ tag: "AADDS" }]);
}

// From s.f, get  S --> S, &s.f
function structMemberExpression(exp: ast.StructMemberExpression) {
    const object = exp.deref ? expression(exp.object) : lvalue(exp.object as ast.LValue);
    return object.concat([{ tag: "AADDF", struct: exp.struct!, field: exp.field.name }]);
}

function assignmentOp(
    operator: "+=" | "-=" | "*=" | "/=" | "%=" | "<<=" | ">>=" | "&=" | "^=" | "|="
): Instruction {
    let instr: Instruction;
    switch (operator) {
        case "+=":
            instr = { tag: "IADD" };
            break;
        case "-=":
            instr = { tag: "ISUB" };
            break;
        case "*=":
            instr = { tag: "IMUL" };
            break;
        case "/=":
            instr = { tag: "IDIV" };
            break;
        case "%=":
            instr = { tag: "IREM" };
            break;
        case "<<=":
            instr = { tag: "ISHL" };
            break;
        case ">>=":
            instr = { tag: "ISHR" };
            break;
        case "&=":
            instr = { tag: "IAND" };
            break;
        case "^=":
            instr = { tag: "IXOR" };
            break;
        case "|=":
            instr = { tag: "IOR" };
            break;
        /* istanbul ignore next */
        default:
            instr = impossible(operator);
            break;
    }
    return instr;
}

function lvalue(exp: ast.LValue): Instruction[] {
    switch (exp.tag) {
        /* istanbul ignore next */
        case "Identifier":
            throw new ImpossibleError("lvalue() called on identifier");
        case "UnaryExpression":
            return expression(exp.argument);
        case "ArrayMemberExpression":
            return arrayMemberExpression(exp);
        case "StructMemberExpression":
            return structMemberExpression(exp);
        /* istanbul ignore next */
        default:
            return impossible(exp);
    }
}

const label = (() => {
    let n = 0;
    return (x: string) => {
        return `${x}_${++n}`;
    };
})();

export function expression(exp: ast.Expression): Instruction[] {
    switch (exp.tag) {
        case "Identifier":
            return [{ tag: "VLOAD", argument: exp.name }];
        case "IntLiteral":
            return [{ tag: "IPUSH", argument: exp.value }];
        case "StringLiteral":
            return [{ tag: "SPUSH", argument: exp.value }];
        case "CharLiteral":
            return [{ tag: "CPUSH", argument: exp.value }];
        case "BoolLiteral":
            return [{ tag: "BPUSH", argument: exp.value }];
        case "NullLiteral":
            return [{ tag: "ACONST_NULL" }];
        case "ArrayMemberExpression":
            return arrayMemberExpression(exp).concat([load(exp.size!)]);
        case "StructMemberExpression":
            return structMemberExpression(exp).concat([load(exp.size!)]);
        case "CallExpression": {
            let args: Instruction[] = exp.loc ? [{ tag: "POSITION", argument: exp.loc }] : [];
            for (let arg of exp.arguments) {
                args = args.concat(expression(arg));
            }
            return args.concat([{ tag: "INVOKESTATIC", argument: exp.callee.name }]);
        }
        case "IndirectCallExpression": {
            let args = expression(exp.callee);
            for (let arg of exp.arguments) {
                args = args.concat(expression(arg));
            }
            return args.concat([{ tag: "INVOKEDYNAMIC", argument: exp.arguments.length }]);
        }
        case "CastExpression": {
            if (!exp.direction) return [];
            if (exp.direction === "TO_VOID") {
                return expression(exp.argument).concat([{ tag: "ADDTAG", cast: exp.typename! }]);
            } else {
                return expression(exp.argument).concat([{ tag: "CHECKTAG", cast: exp.typename! }]);
            }
        }
        case "UnaryExpression": {
            switch (exp.operator) {
                case "!":
                    return conditionalexpression(exp);
                case "&": {
                    /* istanbul ignore next */
                    if (exp.argument.tag !== "Identifier")
                        throw new ImpossibleError("expression: address-of non-identifier");
                    return [{ tag: "FUNCTIONADDRESS", argument: exp.argument.name }];
                }
                case "*": {
                    return expression(exp.argument).concat([load(exp.size!)]);
                }
                case "-": {
                    if (exp.argument.tag === "IntLiteral") {
                        return [{ tag: "IPUSH", argument: -exp.argument.value | 0 }];
                    } else {
                        return expression(exp.argument).concat([
                            { tag: "IPUSH", argument: 0 },
                            { tag: "SWAP" },
                            { tag: "ISUB" }
                        ]);
                    }
                }
                case "~":
                    return expression(exp.argument).concat([{ tag: "IPUSH", argument: -1 }, { tag: "IXOR" }]);
                default:
                    return impossible(exp.operator);
            }
        }
        case "BinaryExpression": {
            const instrs = expression(exp.left).concat(expression(exp.right));
            switch (exp.operator) {
                case "*":
                    return instrs.concat([{ tag: "IMUL" }]);
                case "/":
                    return instrs.concat([{ tag: "IDIV" }]);
                case "%":
                    return instrs.concat([{ tag: "IREM" }]);
                case "+":
                    return instrs.concat([{ tag: "IADD" }]);
                case "-":
                    return instrs.concat([{ tag: "ISUB" }]);
                case "<<":
                    return instrs.concat([{ tag: "ISHL" }]);
                case ">>":
                    return instrs.concat([{ tag: "ISHR" }]);
                case "&":
                    return instrs.concat([{ tag: "IAND" }]);
                case "^":
                    return instrs.concat([{ tag: "IXOR" }]);
                case "|":
                    return instrs.concat([{ tag: "IOR" }]);
                case "<":
                case "<=":
                case ">=":
                case ">":
                case "==":
                case "!=":
                    return conditionalexpression(exp);
                default:
                    return impossible(exp.operator);
            }
        }
        case "LogicalExpression":
            return conditionalexpression(exp);
        case "ConditionalExpression": {
            const labelTrue = label("true");
            const labelFalse = label("false");
            const labelEnd = label("end");
            return conditional(exp.test, labelTrue, labelFalse)
                .concat([{ tag: "LABEL", argument: labelTrue }])
                .concat(expression(exp.consequent))
                .concat([{ tag: "GOTO", argument: labelEnd }, { tag: "LABEL", argument: labelFalse }])
                .concat(expression(exp.alternate))
                .concat([{ tag: "LABEL", argument: labelEnd }]);
        }
        case "AllocExpression":
            return [{ tag: "NEW", argument: exp.size! }];
        case "AllocArrayExpression":
            return expression(exp.argument).concat([{ tag: "NEWARRAY", argument: exp.size! }]);
        case "ResultExpression":
            return [{ tag: "VLOAD", argument: "\\result" }];
        case "LengthExpression":
            return expression(exp.argument).concat([{ tag: "ARRAYLENGTH" }]);
        case "HasTagExpression":
            return conditionalexpression(exp);
        default:
            return impossible(exp);
    }
}

export function statement(
    stm: ast.Statement,
    contracts: boolean,
    lBreak?: string,
    lCont?: string
): Instruction[] {
    switch (stm.tag) {
        case "ExpressionStatement":
            return expression(stm.expression).concat([{ tag: "POP" }]);
        case "UpdateStatement": {
            return statement(
                {
                    tag: "AssignmentStatement",
                    left: stm.argument,
                    right: { tag: "IntLiteral", value: 1, raw: "~1~" },
                    operator: stm.operator === "++" ? "+=" : "-=",
                    size: { tag: "IntType" }
                },
                contracts,
                lBreak,
                lCont
            );
        }
        case "AssignmentStatement": {
            const value = expression(stm.right);
            if (stm.left.tag === "Identifier") {
                const x = stm.left.name;
                if (stm.operator === "=") {
                    return value.concat([{ tag: "VSTORE", argument: x }]);
                } else {
                    return [{ tag: "VLOAD", argument: x } as Instruction]
                        .concat(value)
                        .concat([assignmentOp(stm.operator), { tag: "VSTORE", argument: x }]);
                }
            } else {
                const address = lvalue(stm.left);
                if (stm.operator === "=") {
                    return address.concat(value).concat([store(stm.size!)]);
                } else {
                    return address // S, a
                        .concat([{ tag: "DUP" }]) // S, a, a
                        .concat([{ tag: "DUP" }]) // S, a, a, a
                        .concat(value) // S, a, a, v2
                        .concat([{ tag: "SWAP" }]) // S, a, v2, a
                        .concat([load(stm.size!)]) // S, a, v2, v1
                        .concat([{ tag: "SWAP" }]) // S, a, v1, v2
                        .concat([assignmentOp(stm.operator)]) // S, a, v1 (*) v2
                        .concat([store(stm.size!)]); // S
                }
            }
        }
        case "VariableDeclaration": {
            if (stm.init === null) {
                return [];
            } else {
                return expression(stm.init).concat([{ tag: "VSTORE", argument: stm.id.name }]);
            }
        }
        case "IfStatement": {
            const labelTrue = label("if_true");
            const labelFalse = label("if_false");
            const labelEnd = label("if_end");
            return conditional(stm.test, labelTrue, stm.alternate ? labelFalse : labelEnd)
                .concat([{ tag: "LABEL", argument: labelTrue }])
                .concat(statement(stm.consequent, contracts, lBreak, lCont))
                .concat([{ tag: "GOTO", argument: labelEnd }])
                .concat([{ tag: "LABEL", argument: labelFalse }])
                .concat(stm.alternate ? statement(stm.alternate, contracts, lBreak, lCont) : [])
                .concat([{ tag: "LABEL", argument: labelEnd }]);
        }
        case "WhileStatement": {
            const labelStart = label("while_start");
            const labelLoop = label("while_loop");
            const labelExit = label("while_exit");
            const invariants = contracts
                ? stm.invariants.reduce<Instruction[]>((instrs, exp, i) => {
                      const labelInvariantGood = label(`while_invariant_${i}_ok`);
                      const labelInvariantFail = label(`while_invariant_${i}_fail`);
                      return instrs
                          .concat(conditional(exp, labelInvariantGood, labelInvariantFail))
                          .concat([{ tag: "LABEL", argument: labelInvariantFail }])
                          .concat([{ tag: "SPUSH", argument: "loop invariant failed" }])
                          .concat([{ tag: "ABORT", argument: "loop_invariant" }])
                          .concat([{ tag: "LABEL", argument: labelInvariantGood }]);
                  }, [])
                : [];

            return [{ tag: "LABEL", argument: labelStart } as Instruction]
                .concat(invariants)
                .concat(conditional(stm.test, labelLoop, labelExit))
                .concat([{ tag: "LABEL", argument: labelLoop }])
                .concat(statement(stm.body, contracts, labelExit, labelStart))
                .concat([{ tag: "GOTO", argument: labelStart }])
                .concat([{ tag: "LABEL", argument: labelExit }]);
        }
        case "ForStatement": {
            const labelStart = label("for_start");
            const labelLoop = label("for_loop");
            const labelUpdate = label("for_update");
            const labelExit = label("for_end");
            const invariants = contracts
                ? stm.invariants.reduce<Instruction[]>((instrs, exp, i) => {
                      const labelInvariantGood = label(`for_invariant_${i}_ok`);
                      const labelInvariantFail = label(`for_invariant_${i}_fail`);
                      return instrs
                          .concat(conditional(exp, labelInvariantGood, labelInvariantFail))
                          .concat([{ tag: "LABEL", argument: labelInvariantFail }])
                          .concat([{ tag: "SPUSH", argument: "loop invariant failed" }])
                          .concat([{ tag: "ABORT", argument: "loop_invariant" }])
                          .concat([{ tag: "LABEL", argument: labelInvariantGood }]);
                  }, [])
                : [];

            return (stm.init ? statement(stm.init, contracts, lBreak, lCont) : [])
                .concat([{ tag: "LABEL", argument: labelStart }])
                .concat(invariants)
                .concat(conditional(stm.test, labelLoop, labelExit))
                .concat([{ tag: "LABEL", argument: labelLoop }])
                .concat(statement(stm.body, contracts, labelExit, labelUpdate))
                .concat([{ tag: "LABEL", argument: labelUpdate }])
                .concat(stm.update ? statement(stm.update, contracts, lBreak, lCont) : [])
                .concat([{ tag: "GOTO", argument: labelStart }])
                .concat([{ tag: "LABEL", argument: labelExit }]);
        }
        case "ReturnStatement": {
            if (!contracts) {
                return (stm.argument ? expression(stm.argument) : []).concat([{ tag: "RETURN" }]);
            } else {
                return (stm.argument
                    ? expression(stm.argument).concat([{ tag: "VSTORE", argument: "\\result" }])
                    : []
                ).concat([{ tag: "GOTO", argument: "return" }]);
            }
        }
        case "BlockStatement":
            return stm.body.reduce<Instruction[]>(
                (instrs, stm) => instrs.concat(statement(stm, contracts, lBreak, lCont)),
                []
            );
        case "AssertStatement": {
            const assertBad = label("assert_fail");
            const assertGood = label("assert_pass");
            if (!contracts && stm.contract) return [];
            return conditional(stm.test, assertGood, assertBad)
                .concat([{ tag: "LABEL", argument: assertBad }])
                .concat([{ tag: "SPUSH", argument: "assert failed" }])
                .concat([{ tag: "ABORT", argument: stm.contract ? "assert" : null }])
                .concat([{ tag: "LABEL", argument: assertGood }]);
        }
        case "ErrorStatement":
            return expression(stm.argument).concat([{ tag: "ATHROW" }]);
        case "BreakStatement":
            return [{ tag: "GOTO", argument: lBreak! }];
        case "ContinueStatement":
            return [{ tag: "GOTO", argument: lCont! }];
        default:
            return impossible(stm);
    }
}

export function program(libs: ast.Declaration[], decls: ast.Declaration[], contracts: boolean): Program {
    const native_pool = new Map<string, number>();
    const function_pool = new Map<string, Function>();

    for (let decl of libs) {
        switch (decl.tag) {
            case "FunctionDeclaration": {
                native_pool.set(decl.id.name, decl.params.length);
            }
        }
    }

    for (let decl of decls) {
        switch (decl.tag) {
            case "FunctionDeclaration": {
                const f = decl.id.name;
                if (decl.body !== null) {
                    const preconditions = contracts
                        ? decl.preconditions.reduce<Instruction[]>((instrs, exp, i) => {
                              const labelInvariantGood = label(`precondition_${i}_ok`);
                              const labelInvariantFail = label(`precondition_${i}_fail`);
                              return instrs
                                  .concat(conditional(exp, labelInvariantGood, labelInvariantFail))
                                  .concat([{ tag: "LABEL", argument: labelInvariantFail }])
                                  .concat([
                                      { tag: "SPUSH", argument: `postcondition ${i + 1} of ${f} failed` }
                                  ])
                                  .concat([{ tag: "ABORT", argument: "requires" }])
                                  .concat([{ tag: "LABEL", argument: labelInvariantGood }]);
                          }, [])
                        : [];
                    const postconditions = contracts
                        ? decl.postconditions
                              .reduce<Instruction[]>(
                                  (instrs, exp, i) => {
                                      const labelInvariantGood = label(`postcondition_${i}_ok`);
                                      const labelInvariantFail = label(`postcondition_${i}_fail`);
                                      return instrs
                                          .concat(conditional(exp, labelInvariantGood, labelInvariantFail))
                                          .concat([{ tag: "LABEL", argument: labelInvariantFail }])
                                          .concat([
                                              {
                                                  tag: "SPUSH",
                                                  argument: `postcondition ${i + 1} of ${f} failed`
                                              }
                                          ])
                                          .concat([{ tag: "ABORT", argument: "requires" }])
                                          .concat([{ tag: "LABEL", argument: labelInvariantGood }]);
                                  },
                                  [{ tag: "LABEL", argument: "return" }]
                              )
                              .concat(
                                  decl.returns.tag === "VoidType"
                                      ? []
                                      : [{ tag: "VLOAD", argument: "\\result" }, { tag: "RETURN" }]
                              )
                        : [];
                    const code = preconditions.concat(statement(decl.body, contracts)).concat(postconditions);

                    const args = decl.params.map(param => param.id.name);
                    const labels = new Map<string, number>();
                    code.forEach((instr, i) => {
                        if (instr.tag === "LABEL") labels.set(instr.argument, i);
                    });

                    function_pool.set(decl.id.name, {
                        args: args,
                        code: code,
                        labels: labels
                    });

                    const instrs = statement(decl.body, contracts);
                    for (let instr of instrs) {
                        instructionToString(instr);
                    }
                }
            }
        }
    }

    return {
        native_pool: native_pool,
        function_pool: function_pool,
        struct_pool: computeStructMap(libs, decls)
    };
}
