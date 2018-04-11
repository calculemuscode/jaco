# Parses a superset of C1 statements

@lexer lexer
@include "./expression.ne"

# Resolves if-then-else chaining with the approach from here:
# https://stackoverflow.com/questions/12731922/reforming-the-grammar-to-remove-shift-reduce-conflict-in-if-then-else/12732388#12732388
# This approach is wrong and I should mention that if I ever get the SO reputation
# https://stackoverflow.com/questions/12720219/bison-shift-reduce-conflict-unable-to-resolve/12720483#12720483
# It ambiguously parses if (_) if (_) _; else if (_) if (_) _;
# It seems like this should be handleable with a EBNF in a more nearely-friendly way

Statement      -> Annos_ DanglingIf
                | Annos_ NoDanglingIf

NoDanglingIf   -> Simple _ ";" {% (x) => ({a: x[1]}) %}
                | "while" _ "(" _ Expression _ ")" _Annos _ NoDanglingIf
                | "for" _ "(" (_ Simple):? _ ";" _ Expression _ ";" (_ Expression):? _ ")" _Annos _ NoDanglingIf
                | "if" _ "(" _ Expression _ ")" _Annos _ NoDanglingIf _ "else" _Annos _ NoDanglingIf
                | "return" (_ Expression):? _ ";"
                | StatementBlock
                | "break" _ ";"
                | "continue" _ ";"

DanglingIf     -> "while" _ "(" _ Expression _ ")" _Annos _ DanglingIf
                | "for" _ "(" (_ Simple):? _ ";" _ Expression _ ";" (_ Expression):? _ ")" _Annos _ DanglingIf
                | "if" _ "(" _ Expression _ ")" _ Statement
                | "if" _ "(" _ Expression _ ")" _Annos _ NoDanglingIf _ "else" _Annos _ DanglingIf

Simple         -> Tp _ Identifier (_ "=" _ Expression):? {% (x) => ({b: x}) %}
                | Expression {% (x) => ({c: x}) %}

StatementBlock -> "{" (_ Statement):* (_ Anno1):* _ "}"

Anno           -> ("loop_invariant" | "assert" | "requires" | "ensures") _ Expression _ ";"
Anno1          -> %anno_start _ Anno:+ _ %anno_end
                | %anno_line_start _ Anno:+ _ %anno_end
                | %anno_line_start _ Anno:+ _ %comment_line_start %comment:* %comment_line_end
Annos_         -> (Anno1 _):*
_Annos         -> (_ Anno1):*