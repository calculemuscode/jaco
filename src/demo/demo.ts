import { parseProgram } from "../parse";
import { checkProgram } from "../typecheck/programs";

import * as CodeMirror from "codemirror";
import { List } from "../../node_modules/immutable";

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
        const program = parseProgram("C1", prog);
        try {
            checkProgram(List(), program);
            output.innerText = JSON.stringify(program, null, 2);
        } catch (e) {
            output.innerText = e.message + "\n\n====\n\n" + JSON.stringify(program, null, 2);
        }
    } catch (e) {
        output.innerText = e.message;
    }
}

inputDoc.on("update", (x: any) => {
    draw(inputDoc.getValue());
});
draw(inputDoc.getValue());
