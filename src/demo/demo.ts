import { parseProgram } from "../parse/index";
import { checkProgram } from "../typecheck/programs";

import * as CodeMirror from "codemirror";
import { ParsingError } from "../error";

declare global {
    interface Window {
        jaco: any;
    }
}

const inputDoc = CodeMirror(document.getElementById("input")!, {
    value: "int main() {\n  return 17;\n}",
    lineNumbers: true
});
const output = document.getElementById("output")!;

function draw(prog: string) {
    try {
        const program = parseProgram("C0", prog);
        try {
            checkProgram([], program);
            output.innerText = JSON.stringify(program, null, 2);
        } catch (e) {
            output.innerText = e.message + "\n\n====\n\n" + JSON.stringify(program, null, 2);
        }
    } catch (e) {
        if (e instanceof Error && e.name === "ParsingError" && (e as ParsingError).range) {
            let start = (e as ParsingError).range![0];
            let end = (e as ParsingError).range![1];
            let linum = 1;
            let pos: number;
            let position;
            console.log([start, end])
            while ((pos = prog.indexOf("\n")) !== -1) {
                if (start <= pos) {
                    position = {
                        begin: { line: linum, ch: start },
                        end: { line: linum, ch: end <= pos ? end : pos }
                    };
                    break;
                }
                prog = prog.slice(pos + 1);
                console.log(prog);
                linum += 1;
                start -= pos + 1;
                end -= pos + 1;
            }
            position = {
                begin: { line: linum, ch: start },
                end: { line: linum, ch: end }
            };
            console.log(position);
        }
        output.innerText = e.message;
    }
}

inputDoc.on("update", (x: any) => {
    draw(inputDoc.getValue());
});
draw(inputDoc.getValue());
