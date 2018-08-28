import * as ast from "../ast";
import { Instruction, instructionToString } from "./high-level";
import { ImpossibleError } from "../error";
import { impossible } from "../../node_modules/@calculemus/impossible";

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
        case "PointerType":
            return { tag: "AMLOAD" };
            /* instanbul ignore next */
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
        case "PointerType":
            return { tag: "AMSTORE" };
        default:
            throw new ImpossibleError(`load: ${kind.tag}`);
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
            const instrs = expression(exp.left).concat(expression(exp.right));
            const goto: Instruction = { tag: "GOTO", argument: ifFalse };
            switch (exp.operator) {
                case "<":
                    return instrs.concat([{ tag: "IF_CMPLT", argument: ifTrue }, goto]);
                case "<=":
                    return instrs.concat([{ tag: "IF_CMPLE", argument: ifTrue }, goto]);
                case ">=":
                    return instrs.concat([{ tag: "IF_CMPGE", argument: ifTrue }, goto]);
                case ">":
                    return instrs.concat([{ tag: "IF_CMPGT", argument: ifTrue }, goto]);
                case "==":
                    return instrs.concat([{ tag: "IF_CMPEQ", argument: ifTrue }, goto]);
                case "!=":
                    return instrs.concat([{ tag: "IF_CMPNE", argument: ifTrue }, goto]);
                    /* istanbul ignore next */
                default: throw new ImpossibleError(`conditional() given non-bool BinaryExpression ${exp.operator}`);
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
        case "Identifier":
            throw new ImpossibleError("lvalue() called on identifier");
        case "UnaryExpression":
            return expression(exp.argument);
        case "ArrayMemberExpression":
            return arrayMemberExpression(exp);
        case "StructMemberExpression":
            return structMemberExpression(exp);
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

function expression(exp: ast.Expression): Instruction[] {
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
            let args: Instruction[] = exp.loc ? [{tag: "POSITION", argument: exp.loc }] : [];
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
                return expression(exp.argument).concat([{ tag: "ADDTAG", argument: exp.typename! }]);
            } else {
                return expression(exp.argument).concat([{ tag: "CHECKTAG", argument: exp.typename! }]);
            }
        }
        case "UnaryExpression": {
            switch (exp.operator) {
                case "!":
                    return conditionalexpression(exp);
                case "&": {
                    if (exp.argument.tag !== "Identifier")
                        throw new ImpossibleError("expression: address-of non-identifier");
                    return [{ tag: "FUNCTIONADDRESS", argument: exp.argument.name }];
                }
                case "*": {
                    return expression(exp.argument).concat([load(exp.size!)]);
                }
                case "-": {
                    if (exp.argument.tag === "IntLiteral") {
                        return [{ tag: "IPUSH", argument: -exp.argument.value }];
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
            return expression(exp.argument).concat([{ tag: "CHECKTAG", argument: exp.typename! }]);
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
                        .concat([load(stm.size!)]) // S, a, v1
                        .concat(value) // S, a, v1, v2
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
                ? stm.invariants.reduce<Instruction[]>(
                      (instrs, exp) =>
                          instrs
                              .concat(expression(exp))
                              .concat([{ tag: "ASSERT", argument: "loop_invariant" }]),
                      []
                  )
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
                ? stm.invariants.reduce<Instruction[]>(
                      (instrs, exp) =>
                          instrs
                              .concat(expression(exp))
                              .concat([{ tag: "ASSERT", argument: "loop_invariant" }]),
                      []
                  )
                : [];

            return (stm.init ? statement(stm.init, contracts, lBreak, lCont) : [])
                .concat([{ tag: "LABEL", argument: labelStart }])
                .concat(invariants)
                .concat(conditional(stm.test, labelLoop, labelExit))
                .concat([{ tag: "LABEL", argument: labelLoop }])
                .concat(statement(stm.body, contracts, labelExit, labelUpdate))
                .concat([{ tag: "LABEL", argument: labelUpdate }])
                .concat(stm.update ? statement(stm.update, contracts, lBreak, lCont) : [])
                .concat([{ tag: "LABEL", argument: labelExit }]);
        }
        case "ReturnStatement":
            return (stm.argument ? expression(stm.argument) : [{ tag: "ACONST_NULL" } as Instruction]).concat(
                [{ tag: "RETURN" }]
            );
        case "BlockStatement":
            return stm.body.reduce<Instruction[]>(
                (instrs, stm) => instrs.concat(statement(stm, contracts, lBreak, lCont)),
                []
            );
        case "AssertStatement": {
            if (!contracts && stm.contract) return [];
            return expression(stm.test).concat([{ tag: "ASSERT", argument: stm.contract ? "assert" : null }]);
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

export function program(decls: ast.Declaration[], contracts: boolean) {
    for (let decl of decls) {
        switch (decl.tag) {
            case "FunctionDeclaration": {
                if (decl.body !== null) {
                    //console.log(`FUNCTION ${decl.id.name}`);
                    const instrs = statement(decl.body, contracts);
                    for (let instr of instrs) {
                        instructionToString(instr);
                        //console.log(instructionToString(instr));
                    }
                }
            }
        }
    }
}