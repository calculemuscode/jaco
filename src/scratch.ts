import { readFileSync } from "fs";
import { parseProgram } from "./parse/index";
import { checkProgram } from "./typecheck/programs";
import { program } from "./bytecode/generate";

import Lang from "./lang";
import { execute } from "./bytecode/execute";
import { instructionToString } from "./bytecode/high-level";

function testfile(lang: Lang, filepath: string) {
    const contents = readFileSync(filepath, { encoding: "binary" });
    let lib = parseProgram("C1", readFileSync("./stdlib/15411.h0", { encoding: "binary" }));
    let ast = parseProgram(lang, contents, new Set(["fpt"]));
    checkProgram(lib, ast);
    const bytecode = program(lib, ast, false);
    bytecode.function_pool.get("main")!.code.forEach(instr => console.log(instructionToString(instr)))
    const result = execute(bytecode);
    console.log(result);
    return true;
}

console.log(process.argv);
testfile("C1", process.argv[2]);
