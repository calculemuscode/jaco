# Parses a not-especially-principled superset of C1 statements

@lexer lexer
@include "./expression.ne"

Top -> (_ Statement):* _Annos _ Expression _ {% util.TopExpression %} 
     | (_ Statement):+ _Annos _ {% util.TopStatement %}

Simple         -> Tp _ Identifier (_ "=" _ Expression):?
                | Expression                                {% id %}

BlockStatement -> "{" (_ Statement):* _Annos _ "}"          {% util.BlockStatement %}

# A single annotation is a keyword, an expression, and a semicolon
Anno_          -> ("loop_invariant" | "assert" | "requires" | "ensures") _ Expression _ ";" _
                                                            {% util.Anno %}

# Annotations are grouped and surrounded either by /*@ ... @*/ or //@ ... \n delimiters
# Annotations can include normal comments of their own; 
# it makes the lexer's life easier if we deal with //@ ... // ... \n here as a special case
AnnoSet        -> %anno_start _ Anno_:* %anno_end           {% util.AnnoSet %}
                | %anno_line_start _ Anno_:* %anno_end      {% util.AnnoSet %}
                | %anno_line_start _ Anno_:* %comment_line_start %comment:* %comment_line_end
                                                            {% util.AnnoSet %}

# It's helpful to have a shorthand for "Annotations that capture the space before them"
# as well as "Annotations that capture the space after them"
Annos_         -> (AnnoSet _):*                             {% x => x[0].reduce((xs, y) => xs.concat(y[0]), []) %}
_Annos         -> (_ AnnoSet):*                             {% x => x[0].reduce((xs, y) => xs.concat(y[1]), []) %}
        
# Statements turn out to be tricky when we're not using a shift-reduce parser!
# Shift-reduce parsers have a built-in way of handling the parsing C's grammer, a grammar that
# is ambiguous when we write it down in a "normal" way:
#
#   if (a) if (b) {} else if (c) {}
#          ****** --      ****** -- <- it's like this (but why?)
#   ****** --------- **** ---------
#              
#                         ****** -- <- and not like this (how do we make sure)
#          ****** -- **** ---------
#   ****** ------------------------
#
# The way shift-reduce parsers handle this is to prefer shifting the "else" token onto a stack
# rather than reducing the "if (b) {}" on the top of the stack to a standalone statement
# when the grammar given says either is allowed.
#
# English specifications usually tell humans to associate the "else" with the "if" that is
# closet to it, but that's not something that easily extends to EBNF grammars. We can get closer to
# a working definition if we say that when we write "if (e) S1 else S2", the S1 parse can only contain
# an else-less if inside of curly braces.
#
# I originally used an approach I'm leaving in comments at the end of this file; I haven't
# seen the approach below elsewhere. It achieves the "S1 can only contain else-less if" requirement
# with less repitition of grammar productions by looking at the grammar fragments "if () {} else",
# "while ()", and "for(;;)" as prefixes that can be puton a StatementEnd.
#
# For all I know it has worse performance than my previous attempt! However, it's shorter, and
# the Nearly documentation claims that repetition primitives (like StatementPrefix:*) are good
# for peformance.

Statement         -> (Annos_ StatementPrefix):* Annos_ (StatementEnd | DanglingIf)  {% util.Statement %}
StatementNoDangle -> (Annos_ StatementPrefix):* Annos_ (StatementEnd)               {% util.Statement %}

StatementPrefix -> "if" _ "(" _ Expression _ ")" _ StatementNoDangle _ "else" _     {% util.IfElse %}
                 | "while" _ "(" _ Expression _ ")" _                               {% util.While %}
                 | "for" _ "(" (_ Simple):? _ ";" _ Expression _ ";" (_ Expression):? _ ")" _ {% util.For %}

DanglingIf     -> "if" _ "(" _ Expression _ ")" _ Statement      {% util.IfStatement %}
StatementEnd   -> Simple _ ";"                                   {% util.SimpleStatement %}
                | "return" (_ Expression):? _ ";"                {% util.ReturnStatement %}
                | BlockStatement                                 {% id %}
                | "break" _ ";"                                  {% util.BreakStatement %}
                | "continue" _ ";"                               {% util.ContinueStatement %}





# Resolves if-then-else chaining with the approach from here:
# https://stackoverflow.com/questions/12731922/reforming-the-grammar-to-remove-shift-reduce-conflict-in-if-then-else/12732388#12732388
# The approach below is wrong and I should mention that if I ever get the SO reputation
# https://stackoverflow.com/questions/12720219/bison-shift-reduce-conflict-unable-to-resolve/12720483#12720483
# It ambiguously parses if (a) if (b) {} else if (c) {} if (d) {}
# It seems like this should be handleable with a EBNF in a more nearely-friendly way

#Statement      -> Annos_ DanglingIf
#                | Annos_ NoDanglingIf
#NoDanglingIf   -> Simple _ ";"                              {% util.SimpleStatement %}
#                | "while" _ "(" _ Expression _ ")" _Annos _ NoDanglingIf
#                                                            {% util.WhileStatement %}
#                | "for" _ "(" (_ Simple):? _ ";" _ Expression _ ";" (_ Expression):? _ ")" _Annos _ NoDanglingIf
#                                                            {% util.ForStatement %}
#                | "if" _ "(" _ Expression _ ")" _Annos _ NoDanglingIf _ "else" _Annos _ NoDanglingIf
#                                                            {% util.IfElseStatement %}
#                | "return" (_ Expression):? _ ";"           {% util.ReturnStatement %}
#                | StatementBlock                            {% id %}
#                | "break" _ ";"                             {% util.BreakStatement %}
#                | "continue" _ ";"                          {% util.ContinueStatement %}

#DanglingIf     -> "while" _ "(" _ Expression _ ")" _Annos _ DanglingIf
#                                                            {% util.WhileStatement %}
#                | "for" _ "(" (_ Simple):? _ ";" _ Expression _ ";" (_ Expression):? _ ")" _Annos _ DanglingIf
#                                                            {% util.ForStatement %}
#                | "if" _ "(" _ Expression _ ")" _ Statement {% util.IfStatement %}
#                | "if" _ "(" _ Expression _ ")" _Annos _ NoDanglingIf _ "else" _Annos _ DanglingIf
