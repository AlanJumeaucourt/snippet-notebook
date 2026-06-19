/** Subsequence fuzzy score; higher is better. `null` = no match. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let lastMatch = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 1;
      if (lastMatch === ti - 1) score += 3;
      if (ti === 0 || t[ti - 1] === "_" || t[ti - 1] === "-") score += 2;
      lastMatch = ti;
      qi++;
    }
  }
  return qi === q.length ? score : null;
}

export type FuzzyOption = { label: string; value: string };

export function fuzzyFilterOptions<T extends FuzzyOption>(options: T[], query: string): T[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/[\s_\-./:]+/)
    .filter(Boolean);
  if (tokens.length === 0) return options;
  return options
    .map((opt) => {
      const haystack = `${opt.label} ${opt.value}`.toLowerCase();
      let total = 0;
      for (const token of tokens) {
        const score = fuzzyScore(token, haystack);
        if (score === null) return { opt, score: -1 };
        total += score;
      }
      return { opt, score: total };
    })
    .filter((row) => row.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.opt.label.localeCompare(b.opt.label) ||
        a.opt.value.localeCompare(b.opt.value),
    )
    .map((row) => row.opt);
}
