/*
import { Expression } from "./ast";
import { parseExpression } from "./parse"

const str: string = "15 < x && x < 20"; // Read DOM for student input
const exp: Expression = parseExpression(str);

function grade() {


    if (exp.tag !== "LogicalExpression") { 
        return "notabinop";
    } else if (exp.operator === "||") {
        return "usesor"
    } else if (exp.left.tag !== "BinaryExpression" || exp.right.tag !== "BinaryExpression") {
        return "A";
    }
} */