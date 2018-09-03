import { SourceLocation, ConcreteType } from "../ast";

export type Instruction =
    // Stack Operations
    | { tag: "DUP" }
    | { tag: "POP" }
    | { tag: "SWAP" }

    // Aritmetic
    | { tag: "IADD" }
    | { tag: "IAND" }
    | { tag: "IDIV" }
    | { tag: "IMUL" }
    | { tag: "IOR" }
    | { tag: "IREM" }
    | { tag: "ISHL" }
    | { tag: "ISHR" }
    | { tag: "ISUB" }
    | { tag: "IXOR" }

    // Local Variables
    | { tag: "VLOAD"; argument: string }
    | { tag: "VSTORE"; argument: string }

    // Constants
    | { tag: "ACONST_NULL" }
    | { tag: "BPUSH"; argument: boolean }
    | { tag: "CPUSH"; argument: string }
    | { tag: "IPUSH"; argument: number }
    | { tag: "SPUSH"; argument: string }

    // Control flow
    | { tag: "LABEL"; argument: string }
    | { tag: "POSITION"; argument: SourceLocation }
    | { tag: "IF"; argument: string }
    | { tag: "IF_ACMPEQ"; argument: string }
    | { tag: "IF_ACMPNE"; argument: string }
    | { tag: "IF_BCMPEQ"; argument: string }
    | { tag: "IF_BCMPNE"; argument: string }
    | { tag: "IF_ICMPEQ"; argument: string }
    | { tag: "IF_ICMPNE"; argument: string }
    | { tag: "IF_ICMPLT"; argument: string }
    | { tag: "IF_ICMPGE"; argument: string }
    | { tag: "IF_ICMPGT"; argument: string }
    | { tag: "IF_ICMPLE"; argument: string }
    | { tag: "IF_CCMPEQ"; argument: string }
    | { tag: "IF_CCMPNE"; argument: string }
    | { tag: "IF_CCMPLT"; argument: string }
    | { tag: "IF_CCMPGE"; argument: string }
    | { tag: "IF_CCMPGT"; argument: string }
    | { tag: "IF_CCMPLE"; argument: string }
    | { tag: "GOTO"; argument: string }
    | { tag: "ATHROW" }
    | { tag: "ASSERT"; argument: null | "assert" | "requires" | "ensures" | "loop_invariant" }

    // Functions
    | { tag: "INVOKESTATIC"; argument: string }
    | { tag: "INVOKEDYNAMIC"; argument: number }
    | { tag: "RETURN" }
    | { tag: "INVOKENATIVE"; argument: string }

    // Memory
    | { tag: "NEW"; argument: ConcreteType }
    | { tag: "NEWARRAY"; argument: ConcreteType }
    | { tag: "ARRAYLENGTH" }
    | { tag: "AADDF"; struct: string; field: string }
    | { tag: "AADDS" }
    | { tag: "BMLOAD" }
    | { tag: "BMSTORE" }
    | { tag: "CMLOAD" }
    | { tag: "CMSTORE" }
    | { tag: "IMLOAD" }
    | { tag: "IMSTORE" }
    | { tag: "AMLOAD" }
    | { tag: "AMSTORE" }
    | { tag: "SMLOAD" }
    | { tag: "SMSTORE" }
    | { tag: "FUNCTIONADDRESS"; argument: string }

    // Void pointers
    | { tag: "UNTAG" }
    | { tag: "ADDTAG"; argument: string }
    | { tag: "CHECKTAG"; argument: string }
    | { tag: "HASTAG"; argument: string };

export interface Function {
    args: string[];
    code: Instruction[];
    labels: Map<string, number>;
}

export interface Program {
    function_pool: Map<string, Function>;
}

export function instructionToString(instr: Instruction): string {
    switch (instr.tag) {
        case "LABEL":
            return `.${instr.argument}:`;
        case "ASSERT":
            return `   ASSERT${instr.argument ? "" : ` (${instr.argument})`}`;
        case "POSITION":
            return `   ---`;
        case "VLOAD":
        case "VSTORE":
        case "BPUSH":
        case "CPUSH":
        case "IPUSH":
        case "SPUSH":
        case "IF":
        case "IF_BCMPEQ":
        case "IF_BCMPNE":
        case "IF_ACMPEQ":
        case "IF_ACMPNE":
        case "IF_ICMPEQ":
        case "IF_ICMPNE":
        case "IF_ICMPLT":
        case "IF_ICMPGE":
        case "IF_ICMPGT":
        case "IF_ICMPLE":
        case "IF_CCMPEQ":
        case "IF_CCMPNE":
        case "IF_CCMPLT":
        case "IF_CCMPGE":
        case "IF_CCMPGT":
        case "IF_CCMPLE":
        case "GOTO":
        case "INVOKESTATIC":
        case "INVOKEDYNAMIC":
        case "INVOKENATIVE":
        case "FUNCTIONADDRESS":
        case "ADDTAG":
        case "CHECKTAG":
        case "HASTAG":
            return `   ${instr.tag} ${instr.argument}`;
        case "NEW":
        case "NEWARRAY":
            return `   ${instr.tag} ${instr.argument.tag}`;
        case "AADDF":
            return `   ${instr.tag} ${instr.struct}->${instr.field}`;
        default:
            return `   ${instr.tag}`;
    }
}
