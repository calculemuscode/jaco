import { List, Set } from "immutable";
import * as ast from "../ast";

export type GlobalEnv = {
    readonly libstructs: Set<string>;
    readonly libfuncs: Set<string>;
    readonly decls: List<ast.Declaration>;
};

export type ActualType =
    | ast.IntType
    | ast.BoolType
    | ast.StringType
    | ast.CharType
    | ast.PointerType
    | ast.ArrayType
    | ast.StructType
    | { tag: "NamedFunctionType"; definition: ast.FunctionDeclaration };

export function getTypeDef(genv: GlobalEnv, t: string): ActualType | ast.ValueType | null {
    for (let decl of genv.decls) {
        if (decl.tag === "TypeDefinition" && decl.definition.id.name === t) {
            return decl.definition.kind;
        } else if (decl.tag === "FunctionTypeDefinition" && decl.definition.id.name === t) {
            return {
                tag: "NamedFunctionType",
                definition: decl.definition
            };
        }
    }
    return null;
}

export const initMain: GlobalEnv = {
    libstructs: Set<string>(),
    libfuncs: Set<string>(),
    decls: List<ast.Declaration>([
        {
            tag: "FunctionDeclaration",
            returns: { tag: "IntType" },
            id: { tag: "Identifier", name: "main" },
            params: [],
            preconditions: [],
            postconditions: [],
            body: null
        }
    ])
};

export function addDecl(library: boolean, genv: GlobalEnv, decl: ast.Declaration): GlobalEnv {
    return {
        libstructs:
            library && decl.tag == "StructDeclaration" ? genv.libstructs.add(decl.id.name) : genv.libstructs,
        libfuncs:
            library && decl.tag == "FunctionDeclaration" ? genv.libfuncs.add(decl.id.name) : genv.libfuncs,
        decls: genv.decls.push(decl)
    };
}

export function isLibraryFunction(genv: GlobalEnv, t: string): boolean {
    return genv.libfuncs.has(t);
}

export function isLibraryStruct(genv: GlobalEnv, t: string): boolean {
    return genv.libfuncs.has(t);
}

export function getFunctionDeclaration(genv: GlobalEnv, t: string): ast.FunctionDeclaration | null {
    let result: ast.FunctionDeclaration | null = null;
    for (let decl of genv.decls) {
        if (decl.tag === "FunctionDeclaration" && decl.id.name === t) {
            if (result === null) result = decl;
            if (decl.body !== null) return decl;
        }
    }
    return result;
}

export function getStructDefinition(genv: GlobalEnv, t: string): ast.StructDeclaration | null {
    let result: ast.StructDeclaration | null = null;
    for (let decl of genv.decls) {
        if (decl.tag === "StructDeclaration" && decl.id.name === t) {
            if (result === null) result = decl;
            if (decl.definitions.length > 0) return decl;
        }
    }
    return result;
}

/**
 * Returns a non-Identifier Type based on a type name
 * If parsing is done correctly, this function should only be given type Identifiers,
 * which must have a previous definition.
 */
function expandTypeDef(genv: GlobalEnv, t: ast.Identifier): ActualType {
    let tp = getTypeDef(genv, t.name);

    /* instanbul ignore if */
    if (tp === null) {
        throw new Error(`Could not lookup ${t.name} (this should be impossible, please report)`);
    } else if (tp.tag === "Identifier") {
        return expandTypeDef(genv, tp);
    } else {
        return tp;
    }
}

export function actualType(genv: GlobalEnv, t: ActualType | ast.Type): ActualType | ast.VoidType {
    return t.tag === "Identifier" ? expandTypeDef(genv, t) : t;
}
