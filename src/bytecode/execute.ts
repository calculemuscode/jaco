import { Instruction, Program } from "./high-level";
import { AbortError, ArithmeticError, NonterminationError, MemoryError } from "../error";
import { Builtins } from "./stdlib";
import { ConcreteType } from "../ast";
import { StructMap } from "../typecheck/structs";

export type BasePointerValue = { tag: "basepointer"; value: HeapValue[]; type?: string };
export type LocationValue = { tag: "loc"; value: HeapValue[]; index: number; offset: string[]; };

export type Value =
    | string // runtime value of type string
    | number // runtime value of type int [-2^31, 2^31)
    //                       char [2^31, 2^31 + 128)
    //                       bool -Infinity (false), Infinity (true)
    | null // void*, function pointer, regular pointer
    | { tag: "double"; value: number } // Fake "pointer" type for 15-411 library
    | BasePointerValue
    | { tag: "function"; value: string } // non-null function pointer

export interface Frame {
    stack: (Value | LocationValue)[];
    pc: number;
    bytecode: Instruction[];
    labels: Map<string, number>;
    locals: Map<string, Value>;
}

export type Struct = { tag: "Struct"; struct: string; value: Map<string, HeapValue> };
export type HeapValue = Value | Struct;

export interface State {
    stack: (Value | LocationValue)[];
    pc: number;
    bytecode: Instruction[];
    labels: Map<string, number>;
    locals: Map<string, Value>;
    callstack: Frame[];
}

export function execute(prog: Program, gas?: number): Value {
    const main = prog.function_pool.get("main")!;
    const state: State = {
        stack: [],
        pc: 0,
        bytecode: main.code,
        labels: main.labels,
        locals: new Map(),
        callstack: []
    };

    let result: undefined | Value;
    while (undefined === (result = step(prog, state))) {
        if (gas && --gas == 0) throw new NonterminationError();
    }
    return result;
}

const emptyArray: Value = { tag: "basepointer", value: [], type: "<array>" };
export function init(structs: StructMap, t: ConcreteType): HeapValue {
    switch (t.tag) {
        case "BoolType":
            return -Infinity;
        case "CharType":
            return 0x80000000;
        case "IntType":
            return 0;
        case "PointerType":
            return null;
        case "StringType":
            return "";
        case "TaggedPointerType":
            return null;
        case "ArrayType":
            return emptyArray;
        case "StructType": 
            // We allocate struct elements by need as they are read or written
            return { tag: "Struct", struct: t.id.name, value: new Map<string, HeapValue>() };
    }
}

export function step(prog: Program, state: State): undefined | number {
    //console.log(state.callstack.map(frame => frame.locals));
    //console.log(state.stack);
    //console.log(state.bytecode[state.pc]);

    // Edge case: if the PC ends up at state.bytecode.length, return
    // The stack will be empty, but the returned "undefined" will be ignored
    const instr: Instruction =
        state.pc === state.bytecode.length ? { tag: "RETURN" } : state.bytecode[state.pc];
    state.pc += 1;
    switch (instr.tag) {
        case "RETURN": {
            const result = state.stack.pop()!;
            if (state.callstack.length === 0) {
                return result as number;
            } else {
                const frame = state.callstack.pop()!;
                state.bytecode = frame.bytecode;
                state.pc = frame.pc;
                state.locals = frame.locals;
                state.labels = frame.labels;
                state.stack = frame.stack;
                state.stack.push(result);
                return undefined;
            }
        }

        case "DUP": {
            const v = state.stack.pop()!;
            state.stack.push(v);
            state.stack.push(v);
            return undefined;
        }
        case "POP": {
            state.stack.pop();
            return undefined;
        }
        case "SWAP": {
            const v2 = state.stack.pop()!;
            const v1 = state.stack.pop()!;
            state.stack.push(v2);
            state.stack.push(v1);
            return undefined;
        }

        case "IADD": {
            const y = state.stack.pop() as number;
            const x = state.stack.pop() as number;
            state.stack.push((x + y) | 0);
            return undefined;
        }
        case "IAND": {
            const y = state.stack.pop() as number;
            const x = state.stack.pop() as number;
            state.stack.push((x & y) | 0);
            return undefined;
        }
        case "IDIV": {
            const y = state.stack.pop() as number;
            const x = state.stack.pop() as number;
            if (y === 0) throw new ArithmeticError("division by zero");
            if (x === -0x80000000 && y === -1) throw new ArithmeticError("out-of-bounds division");
            state.stack.push((x / y) | 0);
            return undefined;
        }
        case "IMUL": {
            const y = state.stack.pop() as number;
            const x = state.stack.pop() as number;
            state.stack.push(Math.imul(x, y));
            return undefined;
        }
        case "IOR": {
            const y = state.stack.pop() as number;
            const x = state.stack.pop() as number;
            state.stack.push(x | y | 0);
            return undefined;
        }
        case "IREM": {
            const y = state.stack.pop() as number;
            const x = state.stack.pop() as number;
            if (y === 0) throw new ArithmeticError("division by zero");
            if (x === -0x80000000 && y === -1) throw new ArithmeticError("out-of-bounds division");
            state.stack.push(x % y | 0);
            return undefined;
        }
        case "ISHL": {
            const y = state.stack.pop() as number;
            const x = state.stack.pop() as number;
            if (0 > y || y >= 32) throw new ArithmeticError("shift out of range");
            state.stack.push((x << y) | 0);
            return undefined;
        }
        case "ISHR": {
            const y = state.stack.pop() as number;
            const x = state.stack.pop() as number;
            if (0 > y || y >= 32) throw new ArithmeticError("shift out of range");
            state.stack.push((x >> y) | 0);
            return undefined;
        }
        case "ISUB": {
            const y = state.stack.pop() as number;
            const x = state.stack.pop() as number;
            state.stack.push((x - y) | 0);
            return undefined;
        }
        case "IXOR": {
            const y = state.stack.pop() as number;
            const x = state.stack.pop() as number;
            state.stack.push((x ^ y) | 0);
            return undefined;
        }

        case "VLOAD": {
            state.stack.push(state.locals.get(instr.argument)!);
            return undefined;
        }
        case "VSTORE": {
            state.locals.set(instr.argument, state.stack.pop() as Value);
            return undefined;
        }

        case "ACONST_NULL": {
            state.stack.push(null);
            return undefined;
        }
        case "BPUSH": {
            state.stack.push(instr.argument ? Infinity : -Infinity);
            return undefined;
        }
        case "CPUSH": {
            state.stack.push(instr.argument.charCodeAt(0) + 0x80000000);
            return undefined;
        }
        case "IPUSH": {
            state.stack.push(instr.argument);
            return undefined;
        }
        case "SPUSH": {
            state.stack.push(instr.argument);
            return undefined;
        }

        case "LABEL":
        case "POSITION": {
            return undefined;
        }

        case "IF": {
            if (state.stack.pop() === Infinity) state.pc = state.labels.get(instr.argument)!;
            return undefined;
        }
        case "IF_ACMPEQ": {
            const y = state.stack.pop() as null | BasePointerValue | { tag: "function"; value: string };
            const x = state.stack.pop() as null | BasePointerValue | { tag: "function"; value: string };
            if (x === null && y === null) state.pc = state.labels.get(instr.argument)!;
            if (x !== null && y !== null) {
                if (x.value === y.value) state.pc = state.labels.get(instr.argument)!;
            }
            return undefined;
        }
        case "IF_BCMPEQ":
        case "IF_CCMPEQ":
        case "IF_ICMPEQ": {
            const y = state.stack.pop() as number;
            const x = state.stack.pop() as number;
            if (x == y) state.pc = state.labels.get(instr.argument)!;
            return undefined;
        }
        case "IF_CCMPLT":
        case "IF_ICMPLT": {
            const y = state.stack.pop() as number;
            const x = state.stack.pop() as number;
            if (x < y) state.pc = state.labels.get(instr.argument)!;
            return undefined;
        }
        case "IF_CCMPLE":
        case "IF_ICMPLE": {
            const y = state.stack.pop() as number;
            const x = state.stack.pop() as number;
            if (x <= y) state.pc = state.labels.get(instr.argument)!;
            return undefined;
        }
        case "GOTO": {
            state.pc = state.labels.get(instr.argument)!;
            return undefined;
        }
        case "ABORT": {
            throw new AbortError(instr.argument, state.stack.pop() as string);
        }
        case "INVOKESTATIC": {
            const f = prog.function_pool.get(instr.argument);
            if (!f) {
                const n = prog.native_pool.get(instr.argument)!;
                let args: Value[] = [];
                for (let i = 0; i < n; i++) {
                    args.unshift(state.stack.pop() as Value);
                }
                state.stack.push(Builtins[instr.argument](args));
                return undefined;
            } else {
                const locals = new Map<string, Value>();
                for (let i = f.args.length - 1; i >= 0; i--) {
                    locals.set(f.args[i], state.stack.pop() as Value);
                }

                state.callstack.push({
                    stack: state.stack,
                    pc: state.pc,
                    bytecode: state.bytecode,
                    labels: state.labels,
                    locals: state.locals
                });
                state.stack = [];
                state.pc = 0;
                state.bytecode = f.code;
                state.labels = f.labels;
                state.locals = locals;
                return undefined;
            }
        }

        case "NEW": {
            state.stack.push({ tag: "basepointer", value: [init(prog.struct_pool, instr.argument)] });
            return undefined;
        }
        case "NEWARRAY": {
            const n = state.stack.pop() as number;
            if (n < 0) throw new MemoryError("invalid array size");
            const value = new Array<HeapValue>(n);
            for (let i = 0; i < n; i++) value[i] = init(prog.struct_pool, instr.argument);
            state.stack.push({
                tag: "basepointer",
                value: value,
                type: "<array>"
            });
            return undefined;
        }
        case "ARRAYLENGTH": {
            const A = state.stack.pop() as { tag: "basepointer"; value: HeapValue[]; type: "<array>" };
            state.stack.push(A.value.length);
            return undefined;
        }
        case "AADDF": {
            const a = state.stack.pop() as null | LocationValue | BasePointerValue;
            if (a === null) throw new MemoryError("NULL pointer dereference");
            const index = a.tag === "basepointer" ? 0 : a.index;
            const offset = a.tag === "basepointer" ? [instr.field] : a.offset.concat([instr.field]);
            state.stack.push({ tag: "loc", value: a.value, index: index, offset: offset})
            return undefined
        }
        case "AADDS": {
            const i = state.stack.pop() as number;
            const A = state.stack.pop() as { tag: "basepointer"; value: HeapValue[]; type: "<array>" };
            if (0 > i || i >= A.value.length) throw new MemoryError("out of bounds array access");
            state.stack.push({ tag: "loc", value: A.value, index: i, offset: [] });
            return undefined;
        }

        case "AMLOAD":
        case "IMLOAD":
        case "BMLOAD":
        case "CMLOAD":
        case "SMLOAD": {
            const a = state.stack.pop() as null | LocationValue | BasePointerValue;
            if (a === null) throw new MemoryError("NULL pointer dereference");
            let value: HeapValue = a.tag === "loc" ? a.value[a.index] : a.value[0];
            if (a.tag === "loc") {
                for (let i = 0; i < a.offset.length; i++) {
                    const struct = (value as Struct).value;
                    if (!struct.has(a.offset[i])) {
                        const structType = prog.struct_pool.get((value as Struct).struct)!;
                        struct.set(a.offset[i], init(prog.struct_pool, structType.get(a.offset[i])!));
                    }
                    value = struct.get(a.offset[i])!;
                }
            }
            state.stack.push(value as Value);
            return undefined;
        }

        case "AMSTORE":
        case "IMSTORE":
        case "BMSTORE":
        case "CMSTORE":
        case "SMSTORE": {
            const x = state.stack.pop() as Value;
            const a = state.stack.pop() as null | LocationValue | BasePointerValue;
            if (a === null) throw new MemoryError("NULL pointer dereference");
            const offset = a.tag === "basepointer" ? [] : a.offset;
            const index = a.tag === "basepointer" ? 0 : a.index;
            if (offset.length === 0) {
                a.value[index] = x;
                return undefined;
            } else {
                let value: HeapValue = a.value[index];
                for (let i = 0; i < offset.length - 1; i++) {
                    const struct = (value as Struct).value;
                    if (!struct.has(offset[i])) {
                        const structType = prog.struct_pool.get((value as Struct).struct)!;
                        struct.set(offset[i], init(prog.struct_pool, structType.get(offset[i])!))
                    }
                    value = struct.get(offset[i])!;
                }
                (value as Struct).value.set(offset[offset.length - 1], x);
                return undefined;
            }
        }

        default: {
            throw new Error(`${instr.tag} not implemented`);
        }
    }
}
