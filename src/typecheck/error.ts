export function error(s1: string, s2?: string): never {
    if (s2 === undefined) throw new Error(s1);
    throw new Error(`${s1}\n[Hint: ${s2}]`);
}
