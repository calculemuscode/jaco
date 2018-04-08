# Parses a superset of C1 top-level declarations

@lexer lexer
@include "./expression.ne"
@include "./statement.ne"

Program -> _ (GlobalDecl _):*

GlobalDecl -> %pragma
            | "struct" _ StructName _ ";"
            | "struct" _ StructName _ "{" _ (Tp _ FieldName _ ";" _):* "}" _ ";"
            | Tp _ Identifier _ FunDeclArgs _Annos _ (";" | StatementBlock)
            | "typedef" _ Tp _ Identifier        # Omits trailing semicolon
            | "typedef" _ Tp _ Identifier _ FunDeclArgs _Annos

FunDeclArgs -> "(" _ (Tp _ Identifier _ ("," _ Tp _ Identifier _):*):? ")"