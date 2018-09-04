import { Instruction, Program } from "./high-level";
import { AbortError, ArithmeticError, NonterminationError } from "../error";
import { Builtins } from "./stdlib";

export type Value =
    | string // runtime value of type string
    | number // runtime value of type int [-2^31, 2^31)
    //                       char [2^31, 2^31 + 128)
    //                       bool -Infinity (false), Infinity (true)
    | null // void*, function pointer, regular pointer
    | { tag: "pointer"; value: Value } // non-null regular pointer
    | { tag: "function"; value: string } // non-null function pointer
    | { tag: "tagged"; cast: string; value: Value } // non-null void*
    | { tag: "array"; value: Value[] } // array
    | { tag: "struct"; value: Map<string, Value> }; // struct

export interface Frame {
    stack: Value[];
    pc: number;
    bytecode: Instruction[];
    labels: Map<string, number>;
    locals: Map<string, Value>;
}

export interface State {
    stack: Value[];
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

export function step(prog: Program, state: State): undefined | Value {
    //console.log(state.callstack.map(frame => frame.locals));
    //console.log(state.stack);
    //console.log(state.bytecode[state.pc]);

    // Edge case: if the PC ends up at state.bytecode.length, return
    // The stack will be empty, but the returned "undefined" will be ignored
    const instr: Instruction = state.pc === state.bytecode.length ? {tag: "RETURN"} : state.bytecode[state.pc];
    state.pc += 1;
    switch (instr.tag) {
        case "RETURN": {
            const result = state.stack.pop()!;
            if (state.callstack.length === 0) {
                return result;
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
            state.stack.push(Math.imul(x,y));
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
            state.stack.push((x % y) | 0);
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
            state.locals.set(instr.argument, state.stack.pop()!);
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
                    args.unshift(state.stack.pop()!);
                }
                state.stack.push(Builtins[instr.argument](args));
                return undefined;
            } else {
                const locals = new Map<string, Value>();
                for (let i = f.args.length - 1; i >= 0; i--) {
                    locals.set(f.args[i], state.stack.pop()!);
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
        default: {
            throw new Error(`${instr.tag} not implemented`);
        }
    }
}
