import { parseProgram } from "../parse/index";
import { checkProgram } from "../typecheck/programs";

import * as CodeMirror from "codemirror";
import { ParsingError } from "../error";
import { Position } from "../ast";

declare global {
    interface Window {
        jaco: any;
    }
}

const inputDoc = CodeMirror(document.getElementById("input")!, {
    value: "int main() {\n  return 17;\n}",
    lineNumbers: true
});
const doc = inputDoc.getDoc();
const output = document.getElementById("output")!;

function pos(p: Position): CodeMirror.Position {
    return {
        line: p.line - 1,
        ch: p.column - 1
    };
}
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
        if (e instanceof Error && e.name === "ParsingError" && (e as ParsingError).loc) {
            const loc = (e as ParsingError).loc!;
            doc.markText(pos(loc.start), pos(loc.end), { className: "error", title: e.message });
        } else if ("token" in e) {
            doc.markText(
                pos({ line: e.token.line, column: e.token.col }),
                pos({ line: e.token.line, column: e.token.col + e.token.text.length }),
                { className: "error", title: e.message }
            );
        }
        output.innerText = e.message;
    }
}

let text = inputDoc.getValue();
inputDoc.on("update", (x: any) => {
    if (text !== inputDoc.getValue()) {
        text = inputDoc.getValue();
        doc.getAllMarks().forEach(x => x.clear());
        draw(inputDoc.getValue());
    }
});
draw(inputDoc.getValue());
