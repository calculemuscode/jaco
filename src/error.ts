export class ParsingError extends Error {
    public readonly name: "ParsingError";
    range: null | [number, number];
    constructor(syn: [number, number] | { range?: [number, number] }, msg: string) {
        super(`${syn}\n${msg}`);
        this.name = "ParsingError";
        this.range = syn instanceof Array ? syn : syn.range ? syn.range : null;
    }
}

export class ImpossibleError extends Error {
    public readonly name: "ImpossibleError";
    constructor(msg: string) {
        super(`${msg}\nShould be impossible! (Please report.)`);
        this.name = "ImpossibleError";
    }
}
