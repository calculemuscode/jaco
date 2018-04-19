Parsing takes part across several files. I find having these open simultaneously is helpful:

 * The `expression.ne`, `statement.ne`, and `program.ne` files. There are separate files because of Nearley's design: each file can have only one category it parses, and we potentially want parses for expressions, statements, and (of course) full programs.
 * `ast.ts` contains the "authoritative" C1 grammar This is part of the interface of Jaco.
 * `parser-util.ts` contains functions called by the Nearley parser that create the internal (and unstable) parsed representation (`parsedsyntax.ts`).
 * `restrictsyntax.ts` contains logic for transforming the `parsedsyntax.ts` representation into the `ast.ts` representation.
