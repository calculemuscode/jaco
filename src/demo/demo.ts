import { parseProgramRaw, parseProgram } from "../parse";

import * as CodeMirror from "codemirror";

declare global {
    interface Window {
      jaco: any
    }
  }
  
const inputDoc = CodeMirror(document.getElementById("input")!, {
    value: "int main() {\n  return 17;\n}",
    lineNumbers: true
});
const rawDoc = CodeMirror(document.getElementById("output")!, {
    readOnly: true,
    lineNumbers: true
});
const outputDoc = CodeMirror(document.getElementById("output")!, {
    readOnly: true,
    lineNumbers: true
})

function draw(prog: string) {
    rawDoc.setValue(JSON.stringify(parseProgramRaw(prog), null, 2))
    outputDoc.setValue(JSON.stringify(parseProgram(prog), null, 2)) 
}

inputDoc.on("update", (x:any) => {
    draw(inputDoc.getValue())
});
draw(inputDoc.getValue())
