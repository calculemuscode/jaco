# Parses a superset of C1 expressions
# UpdateStatement and AssignStatement are parsed as Expressions

@{%
const lexer = require('./parser-util').pickyLexer;
const util = require('./parser-util').util;
%}

@lexer lexer

Expression     -> Exp0 {% id %}

Identifier     -> %identifier {% util.Identifier %}
TypeIdentifier -> %type_identifier {% util.Identifier %}
StructName     -> %identifier {% util.Identifier %} | %type_identifier {% util.Identifier %}
FieldName      -> %identifier {% util.Identifier %} | %type_identifier {% util.Identifier %}

Unop           -> "!" | "~" | "-" | "*" | "&" | "(" _ Tp _ ")"
BinopB         -> "*" | "/" | "%"
BinopA         -> "+" | "-"
Binop9         -> "<" "<" | ">" ">"
Binop8         -> "<" | "<" "=" | ">" "=" | ">"
Binop7         -> "=" "=" | "!" "="
Binop6         -> "&"
Binop5         -> "^"
Binop4         -> "|"
Binop3         -> "&&"
Binop2         -> "|" "|"
Binop1         -> "?"
Binop0         -> "=" | "+" "=" | "-" "=" | "*" "=" | "/" "=" | "%" "="
                | "&" "=" | "^" "=" | "|" "=" | "<" "<" "=" | ">" ">" "="

ExpD           -> "(" _ Expression _ ")" {% x => x[2] %}
                | %numeric_literal {% util.IntLiteral %}
                | StringLiteral {% util.StringLiteral %}
                | CharLiteral {% util.CharLiteral %}
                | "true" {% util.BoolLiteral %}
                | "false" {% util.BoolLiteral %}
                | "NULL" {% util.NullLiteral %}
                | Identifier {% id %}
                | Identifier _ Funargs
                | ExpD _ "." _ FieldName | ExpD _ "-" ">" _ FieldName
                | ExpD _ "[" _ Expression _ "]"
                | ExpD _ "+" "+"
                | ExpD _ "-" "-"
                | "alloc" _ "(" _ Tp _ ")" | "alloc_array" _ "(" _ Tp _ "," _ Expression _ ")"
                | "assert" _ "(" _ Expression _ ")"
                | "error" _ "(" _ Expression _ ")"
                | "\\" "result"
                | "\\" "length" _ "(" _ Expression _ ")"
                | "\\" "hastag" _ "(" _ Tp _ "," _ Expression _ ")"
                | "(" _ "*" _ Expression _ ")" _ Funargs
ExpC           -> ExpD {% id %} | Unop _ ExpC
ExpB           -> ExpC {% id %} | ExpC _ BinopB _ ExpB {% util.BinaryExpression %}
ExpA           -> ExpB {% id %} | ExpB _ BinopA _ ExpA {% util.BinaryExpression %}
Exp9           -> ExpA {% id %} | ExpA _ Binop9 _ Exp9 {% util.BinaryExpression %}
Exp8           -> Exp9 {% id %} | Exp9 _ Binop8 _ Exp8 {% util.BinaryExpression %}
Exp7           -> Exp8 {% id %} | Exp8 _ Binop7 _ Exp7 {% util.BinaryExpression %}
Exp6           -> Exp7 {% id %} | Exp7 _ Binop6 _ Exp6 {% util.BinaryExpression %}
Exp5           -> Exp6 {% id %} | Exp6 _ Binop5 _ Exp5 {% util.BinaryExpression %}
Exp4           -> Exp5 {% id %} | Exp5 _ Binop4 _ Exp4 {% util.BinaryExpression %}
Exp3           -> Exp4 {% id %} | Exp4 _ Binop3 _ Exp3 {% util.BinaryExpression %}
Exp2           -> Exp3 {% id %} | Exp3 _ Binop2 _ Exp2 {% util.BinaryExpression %}
Exp1           -> Exp2 {% id %} | Exp2 _ Binop1 _ Expression _ ":" _ Exp1
Exp0           -> Exp1 {% id %} | Exp1 _ Binop0 _ Exp0 {% util.BinaryExpression %}

Funargs        -> "(" _ (Expression _ ("," _ Expression):*):? ")"

Tp             -> "int" | "bool" | "string" | "char" | "void"
                | Tp _ "*"
                | Tp _ "[" _ "]"
                | "struct" _ StructName
                | TypeIdentifier

StringLiteral  -> %string_delimiter (%special_character | %characters):* %string_delimiter
CharLiteral    -> %char_delimiter (%special_character | %character) %char_delimiter

_              -> (%whitespace | %annospace | LineComment | MultiComment):*
LineComment    -> %comment_line_start %comment:* %comment_line_end
MultiComment   -> %comment_start (%comment | MultiComment):* %comment_end
