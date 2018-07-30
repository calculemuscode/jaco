import Lang from "../lang";
import * as syn from "./parsedsyntax";
import * as ast from "../ast";
import { impossible } from "@calculemus/impossible";
import { ParsingError, StandardError } from "../error";

function standard(syn: syn.Syn, lang: Lang, allowed: Lang[], msg: string) {
    for (let ok of allowed) if (lang === ok) return;
    throw new StandardError(syn, lang, msg);
}

export function restrictType(lang: Lang, syn: syn.Type): ast.Type {
    switch (syn.tag) {
        case "IntType":
            return syn;
        case "BoolType":
            standard(syn, lang, ["L2", "L3", "L4", "C0", "C1"], "type 'bool'");
            return syn;
        case "StringType":
            standard(syn, lang, ["C0", "C1"], "type 'string");
            return syn;
        case "CharType":
            standard(syn, lang, ["C0", "C1"], "type 'char");
            return syn;
        case "VoidType":
            standard(syn, lang, ["L3", "L4", "C0", "C1"], "type 'void'");
            return syn;
        case "PointerType":
            standard(syn, lang, ["L4", "C0", "C1"], "pointer types");
            const argument = restrictType(lang, syn.argument);
            if (argument.tag === "VoidType") standard(syn, lang, ["C1"], "type 'void*'");
            return {
                tag: "PointerType",
                argument: argument,
                loc: syn.loc
            };
        case "ArrayType":
            standard(syn, lang, ["L4", "C0", "C1"], "array types");
            return {
                tag: "ArrayType",
                argument: restrictType(lang, syn.argument),
                loc: syn.loc
            };
        case "StructType":
            standard(syn, lang, ["L4", "C0", "C1"], "struct types");
            return syn;
        case "Identifier":
            standard(syn, lang, ["L3", "L4", "C0", "C1"], "defined types");
            return syn;
        default:
            return impossible(syn);
    }
}

export function restrictValueType(lang: Lang, syn: syn.Type): ast.ValueType {
    const type = restrictType(lang, syn);
    if (type.tag === "VoidType") {
        throw new ParsingError(syn, `Type 'void' can only be used as the return type of a function.`);
    }
    return type;
}

export function restrictExpression(lang: Lang, syn: syn.Expression): ast.Expression {
    switch (syn.tag) {
        case "StringLiteral": {
            standard(syn, lang, ["C0", "C1"], "string literals");
            syn.raw.map(x => {
                if (x.length === 2 && x[0] === "\\") {
                    if (!x.match(/\\[ntvbrfa\\'"]/))
                        throw new ParsingError(syn, `Invalid escape '${x}' in string`);
                } else if (!x.match(/\\[ntvbrfa\\'"]+/)) {
                    if (!x.match(/[ !#-~]+/))
                        throw new ParsingError(syn, `Invalid character in string '${x}'`);
                }
            });
            return {
                tag: "StringLiteral",
                value: syn.raw.join(""),
                raw: `"${syn.raw.join("")}"`,
                loc: syn.loc
            };
        }
        case "CharLiteral": {
            standard(syn, lang, ["C0", "C1"], "character literals");
            if (syn.raw.length === 1) {
                if (!syn.raw.match(/[ !#-~]/)) throw new ParsingError(syn, `Invalid character '${syn.raw}'`);
            } else {
                if (!syn.raw.match(/\\[ntvbrfa\\'"0]/))
                    throw new ParsingError(syn, `Invalid escape character '${syn.raw}'`);
            }
            return {
                tag: "CharLiteral",
                value: syn.raw,
                raw: `'${syn.raw}'`,
                loc: syn.loc
            };
        }
        case "BoolLiteral":
            standard(syn, lang, ["L2", "L3", "L4", "C0", "C1"], "'true' and 'false'");
            return { tag: "BoolLiteral", value: syn.value, loc: syn.loc };
        case "NullLiteral":
            standard(syn, lang, ["L4", "C0", "C1"], "'NULL'");
            return { tag: "NullLiteral", loc: syn.loc };
        case "Identifier":
            return syn;
        case "IntLiteral":
            if (syn.raw === "0") {
                return { tag: "IntLiteral", raw: "0", value: 0, loc: syn.loc };
            } else if (syn.raw.startsWith("0") || syn.raw.startsWith("0")) {
                const match = syn.raw.match(/^0[xX](0*)([0-9a-fA-F]+)$/);
                if (match === null) {
                    if (syn.raw[1].toLowerCase() !== "x")
                        throw new ParsingError(
                            syn,
                            `Bad numeric constant: ${
                                syn.raw
                            }\nIdentifiers beginning with '0' must be hex constants starting as '0X' or '0x'`
                        );
                    throw new ParsingError(
                        syn,
                        `Invalid hex constant: ${
                            syn.raw
                        }\nHex constants must only have the characters '0123456789abcdefABCDEF'`
                    );
                }
                const hex = match[2];
                if (hex.length > 8) throw new ParsingError(syn, `Hex constant too large: ${syn.raw}`);
                const value = parseInt(hex, 16);
                return {
                    tag: "IntLiteral",
                    raw: syn.raw,
                    value: value < 0x80000000 ? value : value - 0x100000000,
                    loc: syn.loc
                };
            } else {
                const match = syn.raw.match(/^[0-9]+$/);
                if (match === null) throw new ParsingError(syn, `Invalid integer constant: ${syn.raw}`);
                if (syn.raw.length > 10)
                    throw new ParsingError(syn, `Decimal constant too large: ${syn.raw}`);
                const dec = parseInt(syn.raw, 10);
                if (dec > 2147483648) throw new ParsingError(syn, `Decimal constant too large: ${syn.raw}`);
                return {
                    tag: "IntLiteral",
                    raw: syn.raw,
                    value: dec < 2147483648 ? dec : -2147483648,
                    loc: syn.loc
                };
            }
        case "ArrayMemberExpression": {
            standard(syn, lang, ["L4", "C0", "C1"], "array access");
            return {
                tag: "ArrayMemberExpression",
                object: restrictExpression(lang, syn.object),
                index: restrictExpression(lang, syn.index),
                loc: syn.loc
            };
        }
        case "StructMemberExpression": {
            standard(syn, lang, ["L4", "C0", "C1"], "struct access");
            return {
                tag: "StructMemberExpression",
                deref: syn.deref,
                object: restrictExpression(lang, syn.object),
                field: syn.field,
                loc: syn.loc
            };
        }
        case "CallExpression": {
            standard(syn, lang, ["L3", "L4", "C0", "C1"], "function calls");
            return {
                tag: "CallExpression",
                callee: syn.callee,
                arguments: syn.arguments.map(x => restrictExpression(lang, x)),
                loc: syn.loc
            };
        }
        case "IndirectCallExpression": {
            standard(syn, lang, ["C1"], "function pointer calls");
            return {
                tag: "IndirectCallExpression",
                callee: restrictExpression(lang, syn.callee),
                arguments: syn.arguments.map(x => restrictExpression(lang, x)),
                loc: syn.loc
            };
        }
        case "CastExpression": {
            standard(syn, lang, ["C1"], "casts");
            return {
                tag: "CastExpression",
                kind: restrictValueType(lang, syn.kind),
                argument: restrictExpression(lang, syn.argument),
                loc: syn.loc
            };
        }
        case "UnaryExpression": {
            if (syn.operator === "&") standard(syn, lang, ["C1"], "address-of");
            if (syn.operator === "!") standard(syn, lang, ["L2", "L3", "L4", "C0", "C1"], "boolean negation");
            if (syn.operator === "*") standard(syn, lang, ["L4", "C0", "C1"], "pointer dereference");

            return {
                tag: "UnaryExpression",
                operator: syn.operator,
                argument: restrictExpression(lang, syn.argument),
                loc: syn.loc
            };
        }
        case "BinaryExpression": {
            if (
                syn.operator !== "*" &&
                syn.operator !== "/" &&
                syn.operator !== "%" &&
                syn.operator !== "+" &&
                syn.operator !== "-"
            )
                standard(syn, lang, ["L2", "L3", "L4", "C0", "C1"], `binary operation '${syn.operator}'`);
            return {
                tag: "BinaryExpression",
                operator: syn.operator,
                left: restrictExpression(lang, syn.left),
                right: restrictExpression(lang, syn.right),
                loc: syn.loc
            };
        }
        case "LogicalExpression": {
            standard(syn, lang, ["L2", "L3", "L4", "C0", "C1"], `logical operation '${syn.operator}'`);
            return {
                tag: "LogicalExpression",
                operator: syn.operator,
                left: restrictExpression(lang, syn.left),
                right: restrictExpression(lang, syn.right),
                loc: syn.loc
            };
        }
        case "ConditionalExpression": {
            standard(syn, lang, ["L2", "L3", "L4", "C0", "C1"], "conditional expressions");
            return {
                tag: "ConditionalExpression",
                test: restrictExpression(lang, syn.test),
                consequent: restrictExpression(lang, syn.consequent),
                alternate: restrictExpression(lang, syn.alternate),
                loc: syn.loc
            };
        }
        case "AllocExpression": {
            standard(syn, lang, ["L4", "C0", "C1"], "allocation");
            return {
                tag: "AllocExpression",
                kind: restrictValueType(lang, syn.kind),
                loc: syn.loc
            };
        }
        case "AllocArrayExpression": {
            standard(syn, lang, ["L4", "C0", "C1"], "array allocation");
            return {
                tag: "AllocArrayExpression",
                kind: restrictValueType(lang, syn.kind),
                size: restrictExpression(lang, syn.size),
                loc: syn.loc
            };
        }
        case "ResultExpression": {
            standard(syn, lang, ["C0", "C1"], "'\\result'");
            return {
                tag: "ResultExpression",
                loc: syn.loc
            };
        }
        case "LengthExpression": {
            standard(syn, lang, ["C0", "C1"], "'\\length'");
            return {
                tag: "LengthExpression",
                argument: restrictExpression(lang, syn.argument),
                loc: syn.loc
            };
        }
        case "HasTagExpression": {
            standard(syn, lang, ["C1"], "'\\hastag'");
            return {
                tag: "HasTagExpression",
                kind: restrictValueType(lang, syn.kind),
                argument: restrictExpression(lang, syn.argument),
                loc: syn.loc
            };
        }
        case "AssignmentExpression":
            throw new ParsingError(
                syn,
                `Assignment 'x ${
                    syn.operator
                } e2' must be used as a statement; it is used as an expression here.`
            );
        case "UpdateExpression":
            throw new ParsingError(
                syn,
                `Increment/decrement operation 'e${
                    syn.operator
                }' must be used as a statement; it is used as an expression here.`
            );
        case "AssertExpression":
            throw new ParsingError(
                syn,
                `The 'assert()' function must be used as a statement; it is used as an expression here.`
            );
        case "ErrorExpression":
            throw new ParsingError(
                syn,
                `The 'error()' function must be used as a statement; it is used as an expression here.`
            );
        default:
            return impossible(syn);
    }
}

export function restrictLValue(lang: Lang, syn: syn.Expression): ast.LValue {
    switch (syn.tag) {
        case "Identifier":
            return syn;
        case "StructMemberExpression": {
            standard(syn, lang, ["L4", "C0", "C1"], "struct access");
            return {
                tag: "StructMemberExpression",
                deref: syn.deref,
                object: restrictLValue(lang, syn.object),
                field: syn.field,
                loc: syn.loc
            };
        }
        case "UnaryExpression": {
            if (syn.operator !== "*")
                throw new ParsingError(syn, `Unary ${syn.operator} operator not valid in lvalues`);
            standard(syn, lang, ["L4", "C0", "C1"], "pointer dereference");
            return {
                tag: "UnaryExpression",
                operator: "*",
                argument: restrictLValue(lang, syn.argument),
                loc: syn.loc
            };
        }
        case "ArrayMemberExpression": {
            standard(syn, lang, ["L4", "C0", "C1"], "array access");
            return {
                tag: "ArrayMemberExpression",
                object: restrictLValue(lang, syn.object),
                index: restrictExpression(lang, syn.index),
                loc: syn.loc
            };
        }

        case "IntLiteral":
        case "StringLiteral":
        case "CharLiteral":
        case "BoolLiteral":
        case "NullLiteral":
        case "CallExpression":
        case "IndirectCallExpression":
        case "CastExpression":
        case "BinaryExpression":
        case "LogicalExpression":
        case "ConditionalExpression":
        case "AllocExpression":
        case "AllocArrayExpression":
        case "ResultExpression":
        case "LengthExpression":
        case "HasTagExpression":
        case "UpdateExpression":
        case "AssignmentExpression":
        case "AssertExpression":
        case "ErrorExpression":
            throw new ParsingError(syn, `${syn.tag} is not a valid LValue`);
        default:
            return impossible(syn);
    }
}

export function restrictStatement(lang: Lang, syn: syn.Statement): ast.Statement {
    switch (syn.tag) {
        case "AnnoStatement": {
            if (syn.anno !== "assert")
                throw new ParsingError(
                    syn,
                    `Only assert annotations are allowed here, ${syn.anno} is not permitted.`
                );
            return {
                tag: "AssertStatement",
                contract: true,
                test: restrictExpression(lang, syn.test),
                loc: syn.loc
            };
        }
        case "ExpressionStatement": {
            switch (syn.expression.tag) {
                case "AssignmentExpression": {
                    if (
                        syn.expression.operator !== "=" &&
                        syn.expression.operator !== "*=" &&
                        syn.expression.operator !== "/=" &&
                        syn.expression.operator !== "%=" &&
                        syn.expression.operator !== "+=" &&
                        syn.expression.operator !== "-="
                    )
                        standard(
                            syn,
                            lang,
                            ["L2", "L3", "L4", "C0", "C1"],
                            `assignment operator '${syn.expression.operator}'`
                        );
                    return {
                        tag: "AssignmentStatement",
                        operator: syn.expression.operator,
                        left: restrictLValue(lang, syn.expression.left),
                        right: restrictExpression(lang, syn.expression.right),
                        loc: syn.loc
                    };
                }
                case "UpdateExpression": {
                    standard(
                        syn,
                        lang,
                        ["L2", "L3", "L4", "C0", "C1"],
                        `postfix update 'x${syn.expression.operator}'`
                    );
                    return {
                        tag: "UpdateStatement",
                        operator: syn.expression.operator,
                        argument: restrictLValue(lang, syn.expression.argument),
                        loc: syn.loc
                    };
                }
                case "AssertExpression": {
                    standard(syn, lang, ["L3", "L4", "C0", "C1"], "'assert()'");
                    return {
                        tag: "AssertStatement",
                        contract: false,
                        test: restrictExpression(lang, syn.expression.test),
                        loc: syn.loc
                    };
                }
                case "ErrorExpression": {
                    standard(syn, lang, ["C0", "C1"], "'error()'");
                    return {
                        tag: "ErrorStatement",
                        argument: restrictExpression(lang, syn.expression.argument),
                        loc: syn.loc
                    };
                }
                default: {
                    return {
                        tag: "ExpressionStatement",
                        expression: restrictExpression(lang, syn.expression),
                        loc: syn.loc
                    };
                }
            }
        }
        case "VariableDeclaration": {
            return {
                tag: "VariableDeclaration",
                kind: restrictValueType(lang, syn.kind),
                id: syn.id,
                init: syn.init ? restrictExpression(lang, syn.init) : null,
                loc: syn.loc
            };
        }
        case "IfStatement": {
            standard(syn, lang, ["L2", "L3", "L4", "C0", "C1"], "'if' and 'else'");
            if (!syn.alternate) {
                return {
                    tag: "IfStatement",
                    test: restrictExpression(lang, syn.test),
                    consequent: restrictAssert(lang, syn.consequent),
                    loc: syn.loc
                };
            } else {
                return {
                    tag: "IfStatement",
                    test: restrictExpression(lang, syn.test),
                    consequent: restrictAssert(lang, syn.consequent),
                    alternate: restrictAssert(lang, syn.alternate),
                    loc: syn.loc
                };
            }
        }
        case "WhileStatement": {
            standard(syn, lang, ["L2", "L3", "L4", "C0", "C1"], "'while' loops");
            return {
                tag: "WhileStatement",
                invariants: restrictLoopInvariants(lang, syn.body[0]),
                test: restrictExpression(lang, syn.test),
                body: restrictStatement(lang, syn.body[1]),
                loc: syn.loc
            };
        }
        case "ForStatement": {
            standard(syn, lang, ["L2", "L3", "L4", "C0", "C1"], "'for' loops");
            let init: ast.SimpleStatement | ast.VariableDeclaration | null;
            let update: ast.SimpleStatement | null;

            if (syn.init === null) {
                init = null;
            } else {
                const candidate = restrictStatement(lang, syn.init);
                switch (candidate.tag) {
                    case "AssignmentStatement":
                    case "UpdateStatement":
                    case "ExpressionStatement":
                    case "VariableDeclaration":
                        init = candidate;
                        break;
                    default:
                        throw new ParsingError(
                            syn,
                            `A ${candidate.tag} is not allowed as the first argument of a for statement`
                        );
                }
            }

            if (syn.update === null) {
                update = null;
            } else {
                const candidate = restrictStatement(lang, {
                    tag: "ExpressionStatement",
                    expression: syn.update,
                    loc: syn.loc
                });
                switch (candidate.tag) {
                    case "AssignmentStatement":
                    case "UpdateStatement":
                    case "ExpressionStatement":
                        update = candidate;
                        break;
                    default:
                        throw new ParsingError(
                            syn,
                            `A ${candidate.tag} is not allowed as the third argument of a for statement`
                        );
                }
            }

            return {
                tag: "ForStatement",
                invariants: restrictLoopInvariants(lang, syn.body[0]),
                init: init,
                test: restrictExpression(lang, syn.test),
                update: update,
                body: restrictStatement(lang, syn.body[1]),
                loc: syn.loc
            };
        }
        case "ReturnStatement": {
            return {
                tag: "ReturnStatement",
                argument: syn.argument ? restrictExpression(lang, syn.argument) : null,
                loc: syn.loc
            };
        }
        case "BlockStatement": {
            return {
                tag: "BlockStatement",
                body: syn.body.map(x => restrictStatement(lang, x)),
                loc: syn.loc
            };
        }
        case "BreakStatement": {
            standard(syn, lang, ["C1"], "'break'");
            return syn;
        }
        case "ContinueStatement": {
            standard(syn, lang, ["C1"], "'contine'");
            return syn;
        }
        default:
            return impossible(syn);
    }
}

function restrictAssert(lang: Lang, [annos, stm]: [syn.AnnoStatement[], syn.Statement]): ast.Statement {
    if (annos.length === 0) return restrictStatement(lang, stm);
    const asserts = annos.map<ast.Statement>(x => {
        if (x.anno !== "assert")
            throw new ParsingError(
                syn,
                `The only annotations allowed with if-statements are assertions, ${x.tag} is not permitted`
            );
        return {
            tag: "AssertStatement",
            contract: true,
            test: restrictExpression(lang, x.test),
            loc: x.loc
        };
    });
    return {
        tag: "BlockStatement",
        body: asserts.concat([restrictStatement(lang, stm)]),
        loc: { start: annos[0].loc.start, end: stm.loc.end }
    };
}

function restrictLoopInvariants(lang: Lang, annos: syn.AnnoStatement[]): ast.Expression[] {
    return annos.map(x => {
        if (x.anno !== "loop_invariant")
            throw new ParsingError(
                syn,
                `The only annotations allowed are loop invariants, ${x.tag} is not permitted`
            );
        return restrictExpression(lang, x.test);
    });
}

function restrictFunctionAnnos(
    lang: Lang,
    annos: syn.AnnoStatement[]
): { pre: ast.Expression[]; post: ast.Expression[] } {
    const preconditions: ast.Expression[] = [];
    const postconditions: ast.Expression[] = [];
    annos.map(x => {
        if (x.anno === "requires") {
            preconditions.push(restrictExpression(lang, x.test));
        } else if (x.anno === "ensures") {
            postconditions.push(restrictExpression(lang, x.test));
        } else {
            throw new ParsingError(
                syn,
                `The only annotations allowed are requires and ensures, ${x.anno} is not permitted`
            );
        }
    });
    return { pre: preconditions, post: postconditions };
}

export function restrictParams(
    lang: Lang,
    params: syn.VariableDeclarationOnly[]
): ast.VariableDeclarationOnly[] {
    return params.map(param => ({
        tag: param.tag,
        kind: restrictValueType(lang, param.kind),
        id: param.id
    }));
}

export function restrictDeclaration(lang: Lang, decl: syn.Declaration): ast.Declaration {
    if (typeof decl === "string") return decl;
    switch (decl.tag) {
        case "FunctionDeclaration": {
            if (decl.body === null) standard(decl, lang, ["L3", "L4", "C0", "C1"], "function declarations");
            if (decl.id.name !== null)
                standard(decl, lang, ["L3", "L4", "C0", "C1"], "functions aside from 'main'");

            const annos = restrictFunctionAnnos(lang, decl.annos);
            return {
                tag: "FunctionDeclaration",
                returns: restrictType(lang, decl.returns),
                id: decl.id,
                params: restrictParams(lang, decl.params),
                preconditions: annos.pre,
                postconditions: annos.post,
                body:
                    decl.body === null
                        ? null
                        : {
                              tag: "BlockStatement",
                              body: decl.body.body.map(x => restrictStatement(lang, x)),
                              loc: decl.body.loc
                          }
            };
        }
        case "FunctionTypeDefinition": {
            standard(decl, lang, ["C1"], "function types");

            const annos = restrictFunctionAnnos(lang, decl.definition.annos);
            return {
                tag: "FunctionTypeDefinition",
                definition: {
                    tag: "FunctionDeclaration",
                    returns: restrictType(lang, decl.definition.returns),
                    id: decl.definition.id,
                    params: restrictParams(lang, decl.definition.params),
                    preconditions: annos.pre,
                    postconditions: annos.post,
                    body: null,
                    loc: decl.definition.loc
                },
                loc: decl.loc
            };
        }
        case "StructDeclaration": {
            standard(decl, lang, ["L4", "C0", "C1"], "structs");
            return {
                tag: "StructDeclaration",
                id: decl.id,
                definitions: decl.definitions === null ? null : restrictParams(lang, decl.definitions),
                loc: decl.loc
            };
        }
        case "TypeDefinition": {
            standard(decl, lang, ["L3", "L4", "C0", "C1"], "typedefs");
            return {
                tag: "TypeDefinition",
                definition: {
                    tag: "VariableDeclaration",
                    id: decl.definition.id,
                    kind: restrictValueType(lang, decl.definition.kind),
                    loc: decl.definition.loc
                },
                loc: decl.loc
            };
        }
        default:
            return impossible(decl);
    }
}
