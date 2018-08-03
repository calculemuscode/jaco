import { SourceLocation } from "../ast";
import { ConcreteType } from "../typecheck/recheck";

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
    | { tag: "PUSHSCOPE"; argument: string }
    | { tag: "POPSCOPE" }

    // Constants
    | { tag: "ACONST_NULL" }
    | { tag: "BPUSH"; argument: boolean }
    | { tag: "CPUSH"; argument: string }
    | { tag: "IPUSH"; argument: number }
    | { tag: "APUSH"; argument: string }

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
    | { tag: "ASSERT"; argument: null | "assert" | "requires" | "ensures" }

    // Functions
    | { tag: "INVOKESTATIC"; argument: string }
    | { tag: "INVOKEDYNAMIC"; argument: number }
    | { tag: "RETURN" }
    | { tag: "INVOKENATIVE"; argument: string }

    // Memory
    | { tag: "NEW"; argument: ConcreteType }
    | { tag: "NEWARRAY"; argument: ConcreteType }
    | { tag: "ARRAYLENGTH" }
    | { tag: "AADDF"; argument: string; offset: ConcreteType[] }
    | { tag: "AADDS" }
    | { tag: "BMLOAD" }
    | { tag: "BMSTORE" }
    | { tag: "CMLOAD" }
    | { tag: "CMSTORE" }
    | { tag: "IMLOAD" }
    | { tag: "IMSTORE" }
    | { tag: "AMLOAD" }
    | { tag: "AMSTORE" }
    | { tag: "FUNCTIONADDRESS"; argument: string }

    // Void pointers
    | { tag: "ADDTAG"; argument: ConcreteType }
    | { tag: "CHECKTAG"; argument: ConcreteType }
    | { tag: "HASTAG"; argument: ConcreteType };
