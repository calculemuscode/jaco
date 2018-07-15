# Parses a superset of C1 statements

@lexer lexer
@include "./expression.ne"

# Resolves if-then-else chaining with the approach from here:
# https://stackoverflow.com/questions/12731922/reforming-the-grammar-to-remove-shift-reduce-conflict-in-if-then-else/12732388#12732388
# The approach below is wrong and I should mention that if I ever get the SO reputation
# https://stackoverflow.com/questions/12720219/bison-shift-reduce-conflict-unable-to-resolve/12720483#12720483
# It ambiguously parses if (_) if (_) _; else if (_) if (_) _;
# It seems like this should be handleable with a EBNF in a more nearely-friendly way

Statement      -> Annos_ DanglingIf
                | Annos_ NoDanglingIf

NoDanglingIf   -> Simple _ ";"                              {% util.SimpleStatement %}
                | "while" _ "(" _ Expression _ ")" _Annos _ NoDanglingIf
                                                            {% util.WhileStatement %}
                | "for" _ "(" (_ Simple):? _ ";" _ Expression _ ";" (_ Expression):? _ ")" _Annos _ NoDanglingIf
                                                            {% util.ForStatement %}
                | "if" _ "(" _ Expression _ ")" _Annos _ NoDanglingIf _ "else" _Annos _ NoDanglingIf
                                                            {% util.IfElseStatement %}
                | "return" (_ Expression):? _ ";"           {% util.ReturnStatement %}
                | StatementBlock                            {% id %}
                | "break" _ ";"                             {% util.BreakStatement %}
                | "continue" _ ";"                          {% util.ContinueStatement %}

DanglingIf     -> "while" _ "(" _ Expression _ ")" _Annos _ DanglingIf
                                                            {% util.WhileStatement %}
                | "for" _ "(" (_ Simple):? _ ";" _ Expression _ ";" (_ Expression):? _ ")" _Annos _ DanglingIf
                                                            {% util.ForStatement %}
                | "if" _ "(" _ Expression _ ")" _ Statement {% util.IfStatement %}
                | "if" _ "(" _ Expression _ ")" _Annos _ NoDanglingIf _ "else" _Annos _ DanglingIf
                                                            {% util.IfElseStatement %}

Simple         -> Tp _ Identifier (_ "=" _ Expression):?
                | Expression                                {% id %}

StatementBlock -> "{" (_ Statement):* (_ Anno1):* _ "}"     {% util.BlockStatement %}

Anno_          -> ("loop_invariant" | "assert" | "requires" | "ensures") _ Expression _ ";" _
                                                            {% x => ({ tag: x[0][0].value, test: x[2] }) %}
Anno1          -> %anno_start _ Anno_:* %anno_end           {% util.Anno1 %}
                | %anno_line_start _ Anno_:* %anno_end      {% util.Anno1 %}
                | %anno_line_start _ Anno_:* %comment_line_start %comment:* %comment_line_end
                                                            {% util.Anno1 %}
Annos_         -> (Anno1 _):*                               {% x => x[0].reduce((xs, y) => xs.concat(y[0]), []) %}
_Annos         -> (_ Anno1):*                               {% x => x[0].reduce((xs, y) => xs.concat(y[1]), []) %}