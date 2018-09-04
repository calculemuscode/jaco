import { Value } from "./execute";

export const Builtins : {[f: string]: (x: Value[]) => Value} = {
    fadd: (x: Value[]): Value => {
        const A = new Int32Array(3);
        const B = new Float32Array(A.buffer);
        A[0] = x[0] as number;
        A[1] = x[1] as number;
        B[2] = B[0] + B[1];
        return A[2];
    },

    fsub(x: Value[]): Value {
        const A = new Int32Array(3);
        const B = new Float32Array(A.buffer);
        A[0] = x[0] as number;
        A[1] = x[1] as number;
        B[2] = B[0] - B[1];
        return A[2];
    },

    fmul(x: Value[]): Value {
        const A = new Int32Array(3);
        const B = new Float32Array(A.buffer);
        A[0] = x[0] as number;
        A[1] = x[1] as number;
        B[2] = B[0] * B[1];
        return A[2];
    },

    fdiv(x: Value[]): Value {
        const A = new Int32Array(3);
        const B = new Float32Array(A.buffer);
        A[0] = x[0] as number;
        A[1] = x[1] as number;
        B[2] = B[0] / B[1];
        return A[2];
    },

    fless(x: Value[]): Value {
        const A = new Int32Array(2);
        const B = new Float32Array(A.buffer);
        A[0] = x[0] as number;
        A[1] = x[1] as number;
        return B[0] < B[1] ? Infinity : -Infinity;
    },

    itof(x: Value[]): Value {
        const A = new Int32Array(1);
        const B = new Float32Array(A.buffer);
        B[0] = x[0] as number;
        return A[0];
    },

    ftoi(x: Value[]): Value {
        const A = new Int32Array(1);
        const B = new Float32Array(A.buffer);
        A[0] = x[0] as number;
        if (B[0] === Infinity || B[0] == -Infinity) return -0x80000000;
        return Math.floor(B[0]);
    },

    print_fpt(x: Value[]): Value {
        const A = new Int32Array(1);
        const B = new Float32Array(A.buffer);
        A[0] = x[0] as number;
        console.log(B[0]);
        return null;
    }, 

    print_int(x: Value[]): Value {
        console.log(x[0]);
        return null;
    }, 

    print_hex(x: Value[]): Value {
        console.log((x[0] as number).toString(16));
        return null;
    }
}