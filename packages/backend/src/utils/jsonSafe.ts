export function jsonSafe<T>(input: T): any {
  const seen = new WeakSet();

  const walk = (v: any): any => {
    if (typeof v === 'bigint') return v.toString();
    if (v === null || v === undefined) return v;

    if (typeof v !== 'object') return v;

    if (seen.has(v)) return undefined;
    seen.add(v);

    if (Array.isArray(v)) return v.map(walk);

    const out: any = {};
    for (const [k, val] of Object.entries(v)) out[k] = walk(val);
    return out;
  };

  return walk(input);
}
