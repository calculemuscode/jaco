import { readFileSync } from "fs";
import { parseProgram } from "./parse/index";
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
    checkProgram([], ast);
    console.log(JSON.stringify(ast, undefined, 2));
    return true;
}

testfile("C1", "tests/examples/isqrt.c0");
