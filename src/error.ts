import { SourceLocation } from "./ast";
import Lang from "./lang";

export class ParsingError extends Error {
    public readonly name: "ParsingError";
    loc: null | SourceLocation;
    constructor(syn: SourceLocation | { loc?: SourceLocation }, msg: string) {
        super(`${msg}`);
        this.name = "ParsingError";
        this.loc = "start" in syn ? syn : syn.loc ? syn.loc : null;
    }
}

export class StandardError extends ParsingError {
    constructor(syn: { loc?: SourceLocation }, lang: Lang, msg: string) {
        super(syn, `${msg} not a part of the language '${lang}'`);
    }
}

export class ImpossibleError extends Error {
    public readonly name: "ImpossibleError";
    constructor(msg: string) {
        super(`${msg}\nShould be impossible! (Please report.)`);
        this.name = "ImpossibleError";
    }
}
