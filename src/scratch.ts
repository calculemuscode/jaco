import { List } from "immutable";
import { readFileSync } from "fs";
import * as ast from "./ast";
import { parseProgram } from "./parse";
import { checkProgram } from "./typecheck/programs";
import Lang from "./lang";

function testfile(lang: Lang, filepath: string) {
    //    const contents = `
    //    int main() {
    //        while(x) while(y) while(z) x++;
    //    }
    //    `;
    const contents = readFileSync(filepath, { encoding: "binary" });

    let ast = parseProgram(lang, contents);
    checkProgram(List<ast.Declaration>(), ast);
    console.log(JSON.stringify(ast, undefined, 2));
    return true;
}

testfile("C1", "tests/examples/isqrt.c0");
