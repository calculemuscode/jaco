import * as ast from "../ast";

export type GlobalEnv = ast.Declaration[];

export function getTypeDef(genv: GlobalEnv, t: string): ast.Type | null {
    for (let decl of genv) {
        if (decl.tag === "TypeDefinition" && decl.definition.id.name === t) {
            return decl.definition.kind;
        }
    }
    return null;
}

export function getFunctionDeclaration(genv: GlobalEnv, t: string): ast.FunctionDeclaration | null {
    for (let decl of genv) {
        if (decl.tag === "FunctionDeclaration" && decl.id.name === t) {
            return decl;
        }
    }
    return null;
}

export function getStructDefinition(genv: GlobalEnv, t: string): ast.StructDeclaration | null {
    let result: ast.StructDeclaration | null = null; 
    for (let decl of genv) {
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
export function expandTypeDef(genv: GlobalEnv, t: ast.Identifier): ast.Type {
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