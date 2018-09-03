import { Instruction, Program } from "./high-level";

export type Value =
    | string // runtime value of type string
    | number // runtime value of type int [-2^31, 2^31)
    //                       char [2^31, 2^31 + 128)
    //                       bool -Infinity, Infinity
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

export function execute(prog: Program): Value {
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
    while (undefined === (result = step(prog, state)));
    return result;
}

export function step(prog: Program, state: State): undefined | Value {
    //console.log(state.stack);
    const instr = state.bytecode[state.pc];
    state.pc += 1;
    switch (instr.tag) {
        case "RETURN":
            return state.stack.pop()!;

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
            if (y === 0) throw new Error("division by zero");
            if (x === -0x80000000 && y === -1) throw new Error("division by zero");
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
            if (y === 0) throw new Error("division by zero");
            if (x === -0x80000000 && y === -1) throw new Error("division by zero");
            state.stack.push((x % y) | 0);
            return undefined;
        }
        case "ISHL": {
            const y = state.stack.pop() as number;
            const x = state.stack.pop() as number;
            state.stack.push((x << y) | 0);
            return undefined;
        }
        case "ISHR": {
            const y = state.stack.pop() as number;
            const x = state.stack.pop() as number;
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
        default: {
            throw new Error("Unimplemented");
        }
    }
}
