import * as ast from "../ast";
import { Instruction } from "./h0vm";
import { Env } from "../typecheck/types";
import { recheck, ConcreteType, concrete } from "../typecheck/recheck";
import { ImpossibleError } from "../error";
import { impossible } from "../../node_modules/@calculemus/impossible";
import { GlobalEnv } from "../typecheck/globalenv";

/**
 * assert that a type is an ArrayType, and get the argument
 */
function array(kind: ConcreteType): ConcreteType {
    if (kind.tag !== "ArrayType") throw new ImpossibleError(`expected array, got: ${kind.tag}`);
    return kind.argument;
}

/**
 * assert that a type is an PointerType, get the argument
 */
function pointer(kind: ConcreteType): ConcreteType {
    if (kind.tag !== "PointerType") throw new ImpossibleError(`expected pointer, got: ${kind.tag}`);
    return kind.argument;
}

/**
 * assert that a type is an StructType, get the definition and offset
 */
function struct(kind: ConcreteType, field: string): [ConcreteType[], ConcreteType] {
    const prev: ConcreteType[] = [];
    if (kind.tag !== "StructType" || kind.definition === null)
        throw new ImpossibleError(`struct: expected defined struct, got: ${kind.tag}`);
    for (let decl of kind.definition) {
        if (decl.id === field) return [prev, decl.kind];
        prev.push(decl.kind);
    }
    throw new ImpossibleError(`struct: no definition for ${field} in struct ${kind.id}`);
}

/**
 * return the correct instruction for STACK, addr, v --> STACK (*addr = v)
 */
function load(kind: ConcreteType): Instruction {
    switch (kind.tag) {
        case "BoolType":
            return { tag: "BMLOAD" };
        case "CharType":
            return { tag: "CMLOAD" };
        case "IntType":
            return { tag: "IMLOAD" };
        case "ArrayType":
        case "PointerType":
        case "StringType":
            return { tag: "AMLOAD" };
        default:
            throw new ImpossibleError(`load: ${kind.tag}`);
    }
}

/**
 * return the correct instruction for STACK, addr --> STACK, v (*addr == v)
 */
function store(kind: ConcreteType): Instruction {
    switch (kind.tag) {
        case "BoolType":
            return { tag: "BMSTORE" };
        case "CharType":
            return { tag: "CMSTORE" };
        case "IntType":
            return { tag: "IMSTORE" };
        case "ArrayType":
        case "PointerType":
        case "StringType":
            return { tag: "AMSTORE" };
        default:
            throw new ImpossibleError(`store: ${kind.tag}`);
    }
}

/**
 * evaluating a boolean value jumps to one of the labels
 */
function conditional(
    genv: GlobalEnv,
    env: Env,
    exp: ast.Expression,
    ifTrue: string,
    ifFalse: string
): Instruction[] {
    // Give-up instruction: put the boolean on the stack
    function conditionalFromExpression(exp: ast.Expression): Instruction[] {
        return expression(genv, env, exp).concat([{tag: "IF", argument: ifTrue}, {tag: "GOTO", argument: ifFalse}]);
    }

    return conditionalFromExpression(exp);
}

function lvalue(genv: GlobalEnv, env: Env, exp: ast.LValue): Instruction[] {
    switch (exp.tag) {
        case "Identifier": {
            return [{ tag: "VLOAD", argument: exp.name }];
        }
        case "UnaryExpression": {
            return expression(genv, env, exp.argument);
        }
        case "ArrayMemberExpression": {
            const object = expression(genv, env, exp.object);
            const index = expression(genv, env, exp.index);
            return object.concat([{ tag: "AADDS" }]).concat(index);
        }
        case "StructMemberExpression": {
            const object = exp.deref ? expression(genv, env, exp.object) : lvalue(genv, env, exp.object);
            const [offset] = struct(recheck(genv, env, exp.object), exp.field.name);
            return object.concat([{ tag: "AADDF", argument: exp.field.name, offset: offset }]);
        }
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

function expression(genv: GlobalEnv, env: Env, exp: ast.Expression): Instruction[] {
    switch (exp.tag) {
        case "Identifier":
            return [{ tag: "VLOAD", argument: exp.name }];
        case "IntLiteral":
            return [{ tag: "IPUSH", argument: exp.value }];
        case "StringLiteral":
            return [{ tag: "APUSH", argument: exp.value }];
        case "CharLiteral":
            return [{ tag: "CPUSH", argument: exp.value }];
        case "BoolLiteral":
            return [{ tag: "BPUSH", argument: exp.value }];
        case "NullLiteral":
            return [{ tag: "ACONST_NULL" }];
        case "ArrayMemberExpression": {
            return expression(genv, env, exp.object)
                .concat([{ tag: "AADDS" }])
                .concat(expression(genv, env, exp.index))
                .concat([load(array(recheck(genv, env, exp.object)))]);
        }
        case "StructMemberExpression": {
            const object = exp.deref
                ? expression(genv, env, exp.object)
                : lvalue(genv, env, exp.object as ast.LValue);
            const kind = recheck(genv, env, exp.object);
            const [offset, result] = struct(exp.deref ? pointer(kind) : kind, exp.field.name);
            return object
                .concat([{ tag: "AADDF", argument: exp.field.name, offset: offset }])
                .concat(load(result));
        }
        case "CallExpression": {
            let args: Instruction[] = [];
            for (let arg of exp.arguments) {
                args = args.concat(expression(genv, env, arg));
            }
            return args.concat([{ tag: "INVOKESTATIC", argument: exp.callee.name }]);
        }
        case "IndirectCallExpression": {
            let args = expression(genv, env, exp.callee);
            for (let arg of exp.arguments) {
                args = args.concat(expression(genv, env, arg));
            }
            return args.concat([{ tag: "INVOKEDYNAMIC", argument: exp.arguments.length }]);
        }
        case "CastExpression": {
            let kind = concrete(genv, exp.kind);
            if (kind.tag === "PointerType" && kind.argument.tag === "VoidType") {
                return expression(genv, env, exp.argument).concat([
                    { tag: "ADDTAG", argument: recheck(genv, env, exp.argument) }
                ]);
            } else {
                return expression(genv, env, exp.argument).concat([{ tag: "CHECKTAG", argument: kind }]);
            }
        }
        case "UnaryExpression": {
            switch (exp.operator) {
                case "!": {
                    const t = label("uneg_t");
                    const f = label("uneg_f");
                    const end = label("uneg_end");
                    return conditional(genv, env, exp.argument, t, f).concat([
                        { tag: "LABEL", argument: t },
                        { tag: "BPUSH", argument: false },
                        { tag: "GOTO", argument: end },
                        { tag: "LABEL", argument: f },
                        { tag: "BPUSH", argument: true },
                        { tag: "LABEL", argument: end }
                    ]);
                }
                case "&": {
                    if (exp.argument.tag !== "Identifier")
                        throw new ImpossibleError("expression: address-of non-identifier");
                    return [{ tag: "FUNCTIONADDRESS", argument: exp.argument.name }];
                }
                case "*": {
                    return expression(genv, env, exp.argument).concat([
                        load(pointer(recheck(genv, env, exp.argument)))
                    ]);
                }
                case "-": {
                    if (exp.argument.tag === "IntLiteral") {
                        return [{ tag: "IPUSH", argument: -exp.argument.value }];
                    } else {
                        return expression(genv, env, exp.argument).concat([
                            { tag: "IPUSH", argument: 0 },
                            { tag: "SWAP" },
                            { tag: "ISUB" }
                        ]);
                    }
                }
                case "~":
                    return expression(genv, env, exp.argument).concat([
                        { tag: "IPUSH", argument: -1 },
                        { tag: "IXOR" }
                    ]);
                default:
                    return impossible(exp.operator);
            }
        }
        case "BinaryExpression": {
            const instrs = expression(genv, env, exp.left).concat(expression(genv, env, exp.right));
            const t = label("binopt");
            const f = label("binopf");
            switch (exp.operator) {
                case "*": return instrs.concat([{tag: "IMUL"}]);
                case "/": return instrs.concat([{tag: "IDIV"}]);
                case "%": return instrs.concat([{tag: "IREM"}]);
                case "+": return instrs.concat([{tag: "IADD"}]);
                case "-": return instrs.concat([{tag: "ISUB"}]);
                case "<<": return instrs.concat([{tag: "ISHL"}]);
                case ">>": return instrs.concat([{tag: "ISHR"}]);
                case "&": return instrs.concat([{tag: "IAND"}]);
                case "^": return instrs.concat([{tag: "IXOR"}]);
                case "|": return instrs.concat([{tag: "IOR"}]);
                case "<": return instrs.concat([{tag: "IF_CMPLT"}])
                default: return impossible(exp.operator);
            }
        }
        default:
            impossible(exp);
    }
}
