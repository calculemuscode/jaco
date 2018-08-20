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
    | { tag: "IF_CMPEQ"; argument: string }
    | { tag: "IF_CMPNE"; argument: string }
    | { tag: "IF_CMPLT"; argument: string }
    | { tag: "IF_CMPGE"; argument: string }
    | { tag: "IF_CMPGT"; argument: string }
    | { tag: "IF_CMPLE"; argument: string }
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

    // Void pointers (XXX TODO FIX)
    | { tag: "ADDTAG"; argument: string }
    | { tag: "CHECKTAG"; argument: string }
    | { tag: "HASTAG"; argument: string };

export function instructionToString(instr: Instruction): string {
    switch (instr.tag) {
        case "LABEL": return `.${instr.argument}:`
        case "ASSERT": return `   ASSERT${instr.argument ? "" :` (${instr.argument})`}`
        case "POSITION": return `   ---`;
        case "VLOAD":
        case "VSTORE":
        case "BPUSH":
        case "CPUSH":
        case "IPUSH":
        case "SPUSH":
        case "IF":
        case "IF_CMPEQ":
        case "IF_CMPNE":
        case "IF_CMPLT":
        case "IF_CMPGE":
        case "IF_CMPGT":
        case "IF_CMPLE":
        case "GOTO":
        case "INVOKESTATIC":
        case "INVOKEDYNAMIC":
        case "INVOKENATIVE":
        case "FUNCTIONADDRESS":
        case "ADDTAG":
        case "CHECKTAG":
        case "HASTAG":
            return `   ${instr.tag} ${instr.argument}`
        case "NEW":
        case "NEWARRAY": return `   ${instr.tag} ${instr.argument.tag}`
        case "AADDF": return `    ${instr.tag} ${instr.struct}->${instr.field}`
        default: return `   ${instr.tag}`
    }
}