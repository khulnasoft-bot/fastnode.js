// Module-scoped state of a fastnode module that nothing else in the fixture
// imports. A reload triggered by an unrelated file must not re-evaluate
// (and therefore reset) it.
const g = globalThis as { __fastnodeEvals?: number };

export const fastnodeEvals = (g.__fastnodeEvals = (g.__fastnodeEvals ?? 0) + 1);
