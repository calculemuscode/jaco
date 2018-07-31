import * as ast from "../ast";

export type GlobalEnv = {
    readonly libstructs: Set<string>;
    readonly libfuncs: Set<string>;
    readonly decls: ast.Declaration[];
};

/**
 * An ActualType is the (non-identifier) type that can be typedefed.
 */
export type ActualType =
    | ast.IntType
    | ast.BoolType
    | ast.StringType
    | ast.CharType
    | ast.PointerType
    | ast.ArrayType
    | ast.StructType
    | { tag: "NamedFunctionType"; definition: ast.FunctionDeclaration };

/**
 * Look at a typedef 
 */
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

/**
 * Create an initial GlobalEnv with the correct type for main()
 */
export function initMain(): GlobalEnv {
    return {
        libstructs: new Set<string>(),
        libfuncs: new Set<string>(),
        decls: [
            {
                tag: "FunctionDeclaration",
                returns: { tag: "IntType" },
                id: { tag: "Identifier", name: "main" },
                params: [],
                preconditions: [],
                postconditions: [],
                body: null
            }
        ]
    };
}

export function addDecl(library: boolean, genv: GlobalEnv, decl: ast.Declaration) {
    genv.decls.push(decl);
    if (library) {
        if (decl.tag === "StructDeclaration") genv.libstructs.add(decl.id.name);
        if (decl.tag === "FunctionDeclaration") genv.libfuncs.add(decl.id.name);
    }
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
            if (decl.definitions !== null) return decl;
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
        throw new Imposs(`Could not lookup ${t.name}`);
    } else if (tp.tag === "Identifier") {
        return expandTypeDef(genv, tp);
    } else {
        return tp;
    }
}

export function actualType(genv: GlobalEnv, t: ActualType | ast.Type): ActualType | ast.VoidType {
    return t.tag === "Identifier" ? expandTypeDef(genv, t) : t;
}
