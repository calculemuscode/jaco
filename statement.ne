# Parses a superset of C1 statements

@lexer lexer
@include "./expression.ne"

Statement      -> Annos_ Simple _ ";" {% (x) => ({a: x[1]}) %}
                | Annos_ "if" _ "(" _ Expression _ ")" _ Statement (_ "else" _ Statement):?
                | Annos_ "while" _ "(" _ Expression _ ")" _ Statement
                | Annos_ "for" _ "(" (_ Simple):? _ ";" _ Expression _ ";" (_ Expression):? _ ")" _Annos _ Statement
                | Annos_ "return" (_ Expression):? _ ";"
                | Annos_ StatementBlock

Simple         -> Tp _ Identifier (_ "=" _ Expression):? {% (x) => ({b: x}) %}
                | Expression {% (x) => ({c: x}) %}

StatementBlock -> "{" (_ Statement):* (_ Anno1):* _ "}"

Anno           -> ("loop_invariant" | "assert" | "requires" | "ensures") _ Expression _ ";"
Anno1          -> %anno_start _ Anno:* _ %anno_end
Annos_         -> (Anno1 _):*
_Annos         -> (_ Anno1):*