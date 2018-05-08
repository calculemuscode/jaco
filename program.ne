# Parses a superset of C1 top-level declarations

@lexer lexer
@include "./expression.ne"
@include "./statement.ne"

Program     -> _GlobalDecl:* _ {% x => x[0] %}

_GlobalDecl -> _ GlobalDecl {% x => x[1] %}
GlobalDecl  -> %pragma
             | "struct" _ StructName _ ";" {% x => `struct ${x[2].name} decl ` %}
             | "struct" _ StructName _ "{" _ (Tp _ FieldName _ ";" _):* "}" _ ";"
                                           {% x => `struct ${x[2].name} defn ` %}
             | Tp _ Identifier _ FunDeclArgs _Annos _ FunDeclEnd
                                           {% util.FunctionDeclaration %}
             | "typedef" _ Tp _ Identifier # Omits trailing semicolon
                                           {% x => [`define type ${x[4].name}`, x[4].name] %}
             | "typedef" _ Tp _ Identifier _ FunDeclArgs _Annos # Also omits trailing semicolon
                                           {% x => [`define function type ${x[4].name}`, x[4].name] %}

FunDeclArgs -> "(" _ (Tp _ Identifier _ ("," _ Tp _ Identifier _):*):? ")" {% util.FunctionDeclarationArgs %}
FunDeclEnd -> ";"                          {% x => null %}
FunDeclEnd -> StatementBlock               {% id %}
