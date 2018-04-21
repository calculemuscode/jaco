import { parse } from "../";

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
const outputDoc = CodeMirror(document.getElementById("output")!, {
    readOnly: true,
    lineNumbers: true
})

function draw(prog: string) {
    const output = parse(prog);
    outputDoc.setValue(JSON.stringify(output, null, 2)) 
}

inputDoc.on("update", (x:any) => {
    draw(inputDoc.getValue())
});
draw(inputDoc.getValue())
