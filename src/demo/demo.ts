//import { parseProgram } from "../parse/index";
//import { checkProgram } from "../typecheck/programs";

import "ace";
import { SourceLocation } from "../ast";
//import { SourceLocation } from "../ast";

//import * as CodeMirror from "codemirror";
//import { ParsingError, TypingError } from "../error";
//import { Position, Declaration } from "../ast";

/**
 * Broken in the 
 */
export function pos(p: SourceLocation): AceAjax.Range {
    return new (ace as any).Range(p.start.line - 1, p.start.column - 1, p.end.line - 1, p.end.column - 1);
}

const editor = ace.edit("editor");
editor.setOptions({readOnly: true, highlightActiveLine: false, highlightGutterLine: false, highlightSelectedWord: false, showGutter: false });
//editor.setTheme("ace/theme/monokai");
const range = pos({start: {line: 6, column: 6}, end: {line: 7, column: 7}});
(editor.renderer as any).$cursorLayer.element.style.display = "none";
//editor.session.remove(range);
console.log(editor.session.addMarker(range, "highlit", "text", false));
editor.on("click", (e: any) => { 
    console.log(arguments);
    console.log(e.getDocumentPosition());
});
//editor.session.setMode("ace/mode/javascript");

//const inputDoc = CodeMirror(document.getElementById("input")!, {
//    value: "int main() {\n  return 17;\n}",
//    lineNumbers: true
//});
//const doc = inputDoc.getDoc();
//const output = document.getElementById("output")!;

/*
function pos(p: Position): CodeMirror.Position {
    return {
        line: p.line - 1,
        ch: p.column - 1
    };
}

function draw(prog: string) {
    let program: Declaration[] | null = null;
    let progJSON = "";
    try {
        program = parseProgram("C1", prog);
        progJSON = JSON.stringify(program, null, 2);
        checkProgram([], program);
        output.innerText = progJSON;
    } catch (e) {
        // if (e instanceof Error) outputText = `${e.name}\n===\n${e.message}\n===\n${outputText}`;
        if (e instanceof Error && e.name === "ParsingError" && (e as ParsingError).loc) {
            const loc = (e as ParsingError).loc!;
            doc.markText(pos(loc.start), pos(loc.end), { className: "syntaxerror", title: e.message });
            output.innerText = `Syntax error on line ${loc.start.line}:\n\n${e.message}`;
        } else if (e instanceof Error && e.name === "TypingError" && (e as TypingError).loc) {
            const loc = (e as TypingError).loc!;
            doc.markText(pos(loc.start), pos(loc.end), { className: "typeerror", title: e.message });
            output.innerText = `Type error on line ${loc.start.line}:\n\n${e.message}\n====\n${progJSON}`;
        } else if ("token" in e) {
            doc.markText(
                pos({ line: e.token.line, column: e.token.col }),
                pos({ line: e.token.line, column: e.token.col + e.token.text.length }),
                { className: "badsyntax", title: "syntax error here (or just before here)" }
            );
        } else if (e instanceof Error && e.message === "Incomplete parse at the end of the file") {
            output.innerText = "Incompete parse at the end of the file";
        } else {
            output.innerText = `Unexpected ${e.name}\n===\n${e}`;
        }
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

*/