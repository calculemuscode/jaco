export type OpCode =
    | 0x60 // IADD
    | 0x7e // IAND
    | 0x6c // IDIV
    | 0x68 // IMUL
    | 0x80 // IOR
    | 0x70 // IREM
    | 0x78 // ISHL
    | 0x7a // ISHR
    | 0x64 // ISUB
    | 0x82 // IXOR
    | 0x59 // DUP
    | 0x57 // POP
    | 0x5f // SWAP
    | 0xbc // NEWARRAY
    | 0xbe // ARRAYLENGTH
    | 0xbb // NEW
    | 0x62 // AADDF
    | 0x63 // AADDS
    | 0x2e // IMLOAD
    | 0x2f // AMLOAD
    | 0x4e // IMSTORE
    | 0x4f // AMSTORE
    | 0x34 // CMLOAD
    | 0x55 // CMSTORE
    | 0x15 // VLOAD
    | 0x36 // VSTORE
    | 0x01 // ACONST
    | 0x10 // BIPUSH
    | 0x13 // ILDC
    | 0x14 // ALDC
    | 0x00 // NOP
    | 0x9f // IF_CMPEQ
    | 0xa0 // IF_CMPNE
    | 0xa1 // IF_ICMPLT
    | 0xa2 // IF_ICMPGE
    | 0xa3 // IF_ICMPGT
    | 0xa4 // IF_ICMPLE
    | 0xa7 // GOTO
    | 0xbf // ATHROW
    | 0xcf // ASSERT
    | 0xb8 // INVOKESTATIC
    | 0xb7 // INVOKENATIVE
    | 0xb0; // RETURN

export const NOP: OpCode = 0x0;
export const ACONST: OpCode = 0x1;
export const BIPUSH: OpCode = 0x10;
export const ILDC: OpCode = 0x13;
export const ALDC: OpCode = 0x14;
export const VLOAD: OpCode = 0x15;
export const IMLOAD: OpCode = 0x2e;
export const AMLOAD: OpCode = 0x2f;
export const CMLOAD: OpCode = 0x34;
export const VSTORE: OpCode = 0x36;
export const IMSTORE: OpCode = 0x4e;
export const AMSTORE: OpCode = 0x4f;
export const CMSTORE: OpCode = 0x55;
export const POP: OpCode = 0x57;
export const DUP: OpCode = 0x59;
export const SWAP: OpCode = 0x5f;
export const IADD: OpCode = 0x60;
export const AADDF: OpCode = 0x62;
export const AADDS: OpCode = 0x63;
export const ISUB: OpCode = 0x64;
export const IMUL: OpCode = 0x68;
export const IDIV: OpCode = 0x6c;
export const IREM: OpCode = 0x70;
export const ISHL: OpCode = 0x78;
export const ISHR: OpCode = 0x7a;
export const IAND: OpCode = 0x7e;
export const IOR: OpCode = 0x80;
export const IXOR: OpCode = 0x82;
export const IF_CMPEQ: OpCode = 0x9f;
export const IF_CMPNE: OpCode = 0xa0;
export const IF_ICMPLT: OpCode = 0xa1;
export const IF_ICMPGE: OpCode = 0xa2;
export const IF_ICMPGT: OpCode = 0xa3;
export const IF_ICMPLE: OpCode = 0xa4;
export const GOTO: OpCode = 0xa7;
export const RETURN: OpCode = 0xb0;
export const INVOKENATIVE: OpCode = 0xb7;
export const INVOKESTATIC: OpCode = 0xb8;
export const NEW: OpCode = 0xbb;
export const NEWARRAY: OpCode = 0xbc;
export const ARRAYLENGTH: OpCode = 0xbe;
export const ATHROW: OpCode = 0xbf;
export const ASSERT: OpCode = 0xcf;

export const foo = (x: number[]) => ({
    version_arch: 0,
    int_count: 0,
    int_pool: [],
    string_count: 0,
    string_pool: [],
    function_count: 1,
    function_pool: [x],
    native_count: 0,
    native_pool: []
});
