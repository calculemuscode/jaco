import Lang from "../lang";
import * as syn from "./parsedsyntax";
import * as ast from "../ast";
import { impossible } from "@calculemus/impossible";
import { ParsingError, StandardError } from "../error";

function standard(syn: ast.Syn, lang: Lang, allowed: Lang[], msg: string) {
    for (let ok of allowed) if (lang === ok) return;
    throw new StandardError(syn, lang, msg);
}

export function restrictType(lang: Lang, syn: ast.Type): ast.Type {
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
                argument: argument
            };
        case "ArrayType":
            if (lang === "L1" || lang === "L2" || lang === "L3")
                throw new StandardError(syn, lang, "array types");
            return {
                tag: "ArrayType",
                argument: restrictType(lang, syn.argument)
            };
        case "StructType":
            if (lang === "L1" || lang === "L2" || lang === "L3")
                throw new StandardError(syn, lang, "struct types");
            return syn;
        case "Identifier":
            if (lang === "L1" || lang === "L2") throw new StandardError(syn, lang, "defined types"); // Impossible?
            return syn;
        default:
            return impossible(syn);
    }
}

export function restrictValueType(lang: Lang, syn: ast.Type): ast.ValueType {
    const type = restrictType(lang, syn);
    if (type.tag === "VoidType") {
        throw new ParsingError(syn, `Type 'void' can only be used as the return type of a function.`);
    }
    return type;
}

export function restrictExpression(lang: Lang, syn: syn.Expression): ast.Expression {
    switch (syn.tag) {
        case "StringLiteral": {
            if (lang === "L1" || lang === "L2" || lang === "L3" || lang === "L4")
                throw new StandardError(syn, lang, "string literals");
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
                raw: `"${syn.raw.join("")}"`
            };
        }
        case "CharLiteral": {
            if (lang === "L1" || lang === "L2" || lang === "L3" || lang === "L4")
                throw new StandardError(syn, lang, "character literals");
            if (syn.raw.length === 1) {
                if (!syn.raw.match(/[ !#-~]/)) throw new ParsingError(syn, `Invalid character '${syn.raw}'`);
            } else {
                if (!syn.raw.match(/\\[ntvbrfa\\'"0]/))
                    throw new ParsingError(syn, `Invalid escape character '${syn.raw}'`);
            }
            return {
                tag: "CharLiteral",
                value: syn.raw,
                raw: `'${syn.raw}'`
            };
        }
        case "BoolLiteral":
            if (lang === "L1") throw new StandardError(syn, lang, syn.value ? "'true'" : "'false'");
            return { tag: "BoolLiteral", value: syn.value };
        case "NullLiteral":
            if (lang === "L1" || lang === "L2" || lang === "L3") throw new StandardError(syn, lang, "'NULL'");
            return { tag: "NullLiteral" };
        case "Identifier":
            return syn;
        case "IntLiteral":
            if (syn.raw === "0") {
                return { tag: "IntLiteral", raw: "0", value: 0 };
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
                    value: value < 0x80000000 ? value : value - 0x100000000
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
                    value: dec < 2147483648 ? dec : -2147483648
                };
            }
        case "ArrayMemberExpression": {
            if (lang === "L1" || lang === "L2" || lang === "L3")
                throw new StandardError(syn, lang, "Array access");
            return {
                tag: "ArrayMemberExpression",
                object: restrictExpression(lang, syn.object),
                index: restrictExpression(lang, syn.index)
            };
        }
        case "StructMemberExpression": {
            if (lang === "L1" || lang === "L2" || lang === "L3")
                throw new StandardError(syn, lang, "struct access");
            return {
                tag: "StructMemberExpression",
                deref: syn.deref,
                object: restrictExpression(lang, syn.object),
                field: syn.field
            };
        }
        case "CallExpression": {
            if (lang === "L1" || lang === "L2")
                throw new ParsingError(syn, `Functions are not a part of ${lang}`);
            return {
                tag: "CallExpression",
                callee: syn.callee,
                arguments: syn.arguments.map(x => restrictExpression(lang, x))
            };
        }
        case "IndirectCallExpression": {
            if (lang !== "C1")
                throw new ParsingError(syn, `Calls from function pointers not a part of ${lang}`);
            return {
                tag: "IndirectCallExpression",
                callee: restrictExpression(lang, syn.callee),
                arguments: syn.arguments.map(x => restrictExpression(lang, x))
            };
        }
        case "CastExpression": {
            if (lang !== "C1") throw new ParsingError(syn, `Casts not a part of ${lang}`);
            return {
                tag: "CastExpression",
                kind: restrictValueType(lang, syn.kind),
                argument: restrictExpression(lang, syn.argument)
            };
        }
        case "UnaryExpression": {
            if (syn.operator === "&" && lang !== "C1")
                throw new ParsingError(syn, `Address-of not a part of ${lang}`);
            if (syn.operator === "!" && lang === "L1")
                throw new ParsingError(syn, `Boolean negation not a part of ${lang}`);
            if (syn.operator === "*" && (lang === "L1" || lang === "L2" || lang === "L3"))
                throw new ParsingError(syn, `Pointer dereference not a part of ${lang}`);

            return {
                tag: "UnaryExpression",
                operator: syn.operator,
                argument: restrictExpression(lang, syn.argument)
            };
        }
        case "BinaryExpression": {
            if (lang === "L1") {
                switch (syn.operator) {
                    case "*":
                    case "/":
                    case "%":
                    case "+":
                    case "-":
                        break;
                    default:
                        throw new ParsingError(syn, `Operator ${syn.operator} not a part of ${lang}`);
                }
            }
            return {
                tag: "BinaryExpression",
                operator: syn.operator,
                left: restrictExpression(lang, syn.left),
                right: restrictExpression(lang, syn.right)
            };
        }
        case "LogicalExpression": {
            if (lang === "L1") throw new ParsingError(syn, `Logical operators not a part of ${lang}`);
            return {
                tag: "LogicalExpression",
                operator: syn.operator,
                left: restrictExpression(lang, syn.left),
                right: restrictExpression(lang, syn.right)
            };
        }
        case "ConditionalExpression": {
            if (lang === "L1") throw new ParsingError(syn, `Conditional expression is not a part of ${lang}`);
            return {
                tag: "ConditionalExpression",
                test: restrictExpression(lang, syn.test),
                consequent: restrictExpression(lang, syn.consequent),
                alternate: restrictExpression(lang, syn.alternate)
            };
        }
        case "AllocExpression": {
            if (lang === "L1" || lang === "L2" || lang === "L3")
                throw new ParsingError(syn, `Allocation not a part of ${lang}`);
            return {
                tag: "AllocExpression",
                kind: restrictValueType(lang, syn.kind)
            };
        }
        case "AllocArrayExpression": {
            if (lang === "L1" || lang === "L2" || lang === "L3")
                throw new ParsingError(syn, `Allocation not a part of ${lang}`);
            return {
                tag: "AllocArrayExpression",
                kind: restrictValueType(lang, syn.kind),
                size: restrictExpression(lang, syn.size)
            };
        }
        case "ResultExpression": {
            if (lang === "L1" || lang === "L2" || lang === "L3" || lang === "L4")
                throw new ParsingError(syn, `Contracts not a part of ${lang}`);
            return {
                tag: "ResultExpression"
            };
        }
        case "LengthExpression": {
            if (lang === "L1" || lang === "L2" || lang === "L3" || lang === "L4")
                throw new ParsingError(syn, `Contracts not a part of ${lang}`);
            return {
                tag: "LengthExpression",
                argument: restrictExpression(lang, syn.argument)
            };
        }
        case "HasTagExpression": {
            if (lang !== "C1") throw new ParsingError(syn, `Tag contracts not a part of ${lang}`);
            return {
                tag: "HasTagExpression",
                kind: restrictValueType(lang, syn.kind),
                argument: restrictExpression(lang, syn.argument)
            };
        }
        case "AssignmentExpression":
            throw new ParsingError(
                syn,
                `Assignments 'x ${
                    syn.operator
                } e2' must be used as statements, and not inside of expressions.`
            );
        case "UpdateExpression":
            throw new ParsingError(
                syn,
                `Increment/decrement operations 'e${
                    syn.operator
                }' must be used as statements, and not inside of expressions.`
            );
        case "AssertExpression":
            throw new ParsingError(
                syn,
                `The 'assert()' function must be used as a statement, and not inside of expressions.`
            );
        case "ErrorExpression":
            throw new ParsingError(
                syn,
                `The 'error()' function must be used as a statement, and not inside of expressions.`
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
            if (lang === "L1" || lang === "L2" || lang === "L3")
                throw new ParsingError(syn, `Struct access not a part of ${lang}`);
            return {
                tag: "StructMemberExpression",
                deref: syn.deref,
                object: restrictLValue(lang, syn.object),
                field: syn.field
            };
        }
        case "UnaryExpression": {
            if (syn.operator !== "*") throw new ParsingError(syn, `Not an LValue`);
            if (lang == "L1" || lang === "L2" || lang === "L3")
                throw new ParsingError(syn, `Pointer dereference not a part of ${lang}`);
            return {
                tag: "UnaryExpression",
                operator: "*",
                argument: restrictLValue(lang, syn.argument)
            };
        }
        case "ArrayMemberExpression": {
            if (lang === "L1" || lang === "L2" || lang === "L3")
                throw new ParsingError(syn, `Array access not a part of ${lang}`);
            return {
                tag: "ArrayMemberExpression",
                object: restrictLValue(lang, syn.object),
                index: restrictExpression(lang, syn.index)
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
                test: restrictExpression(lang, syn.test)
            };
        }
        case "ExpressionStatement": {
            switch (syn.expression.tag) {
                case "AssignmentExpression": {
                    if (lang === "L1") {
                        switch (syn.expression.operator) {
                            case "=":
                            case "*=":
                            case "/=":
                            case "%=":
                            case "+=":
                            case "-=":
                                break;
                            default:
                                throw new ParsingError(
                                    syn,
                                    `Assignment operator ${syn.expression.operator} not a part of ${lang}`
                                );
                        }
                    }
                    return {
                        tag: "AssignmentStatement",
                        operator: syn.expression.operator,
                        left: restrictLValue(lang, syn.expression.left),
                        right: restrictExpression(lang, syn.expression.right)
                    };
                }
                case "UpdateExpression": {
                    if (lang === "L1")
                        throw new ParsingError(
                            syn,
                            `Postfix update 'x${syn.expression.operator}' not a part of ${lang}`
                        );

                    return {
                        tag: "UpdateStatement",
                        operator: syn.expression.operator,
                        argument: restrictLValue(lang, syn.expression.argument)
                    };
                }
                case "AssertExpression": {
                    if (lang === "L1" || lang === "L2") {
                        throw new ParsingError(syn, `Assertions not a part of ${lang}`);
                    }
                    return {
                        tag: "AssertStatement",
                        contract: false,
                        test: restrictExpression(lang, syn.expression.test)
                    };
                }
                case "ErrorExpression": {
                    if (lang === "L1" || lang === "L2" || lang === "L3" || lang === "L4") {
                        throw new ParsingError(syn, `The 'error()' function is not a part of ${lang}`);
                    }
                    return {
                        tag: "ErrorStatement",
                        argument: restrictExpression(lang, syn.expression.argument)
                    };
                }
                default: {
                    return {
                        tag: "ExpressionStatement",
                        expression: restrictExpression(lang, syn.expression)
                    };
                }
            }
        }
        case "VariableDeclaration": {
            return {
                tag: "VariableDeclaration",
                kind: restrictValueType(lang, syn.kind),
                id: syn.id,
                init: syn.init ? restrictExpression(lang, syn.init) : null
            };
        }
        case "IfStatement": {
            if (lang === "L1") throw new ParsingError(syn, `Conditionals not a part of ${lang}`);
            if (!syn.alternate) {
                return {
                    tag: "IfStatement",
                    test: restrictExpression(lang, syn.test),
                    consequent: restrictAssert(lang, syn.consequent)
                };
            } else {
                return {
                    tag: "IfStatement",
                    test: restrictExpression(lang, syn.test),
                    consequent: restrictAssert(lang, syn.consequent),
                    alternate: restrictAssert(lang, syn.alternate)
                };
            }
        }
        case "WhileStatement": {
            if (lang === "L1") throw new ParsingError(syn, `Loops not a part of ${lang}`);
            return {
                tag: "WhileStatement",
                invariants: restrictLoopInvariants(lang, syn.body[0]),
                test: restrictExpression(lang, syn.test),
                body: restrictStatement(lang, syn.body[1])
            };
        }
        case "ForStatement": {
            if (lang === "L1") throw new ParsingError(syn, `Loops not a part of ${lang}`);
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
                body: restrictStatement(lang, syn.body[1])
            };
        }
        case "ReturnStatement": {
            return {
                tag: "ReturnStatement",
                argument: syn.argument ? restrictExpression(lang, syn.argument) : null
            };
        }
        case "BlockStatement": {
            return {
                tag: "BlockStatement",
                body: syn.body.map(x => restrictStatement(lang, x))
            };
        }
        case "BreakStatement":
        case "ContinueStatement": {
            if (lang !== "C1")
                throw new ParsingError(syn, `Control with 'break' and 'continue' not a part of ${lang}`);
            return syn;
        }
        default:
            return impossible(syn);
    }
}

function restrictAssert(lang: Lang, [annos, stm]: [syn.AnnoStatement[], syn.Statement]): ast.Statement {
    if (annos.length === 0) return restrictStatement(lang, stm);
    const asserts: ast.Statement[] = annos.map(
        (x): ast.Statement => {
            if (x.anno !== "assert")
                throw new ParsingError(
                    syn,
                    `The only annotations allowed with if-statements are assertions, ${
                        x.tag
                    } is not permitted`
                );
            return {
                tag: "AssertStatement",
                contract: true,
                test: restrictExpression(lang, x.test)
            };
        }
    );
    return {
        tag: "BlockStatement",
        body: asserts.concat([restrictStatement(lang, stm)])
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
            if (lang == "L1" || lang == "L2") {
                if (decl.body === null)
                    throw new ParsingError(syn, `function declarations are not a part of ${lang}`);
                if (decl.id.name !== "main")
                    throw new ParsingError(syn, `only function 'main' can be defined in ${lang}`);
            }

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
                              body: decl.body.body.map(x => restrictStatement(lang, x))
                          }
            };
        }
        case "FunctionTypeDefinition": {
            if (lang != "C1") throw new ParsingError(syn, `function types are not a part of ${lang}`);

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
                    body: null
                }
            };
        }
        case "StructDeclaration": {
            if (lang == "L1" || lang == "L2" || lang == "L3")
                throw new ParsingError(syn, `structs are not a part of ${lang}`);

            return {
                tag: "StructDeclaration",
                id: decl.id,
                definitions: decl.definitions === null ? null : restrictParams(lang, decl.definitions)
            };
        }
        case "TypeDefinition": {
            if (lang == "L1" || lang == "L2")
                throw new ParsingError(syn, `typedefs are not a part of ${lang}`);

            return {
                tag: "TypeDefinition",
                definition: {
                    tag: "VariableDeclaration",
                    id: decl.definition.id,
                    kind: restrictValueType(lang, decl.definition.kind)
                }
            };
        }
        default:
            return impossible(decl);
    }
}