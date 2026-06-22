/**
 * Lightweight in-memory search index - no deps. Tokenises into trigrams and
 * scores by overlap + prefix bonus. Good enough for instant lead/PG/todo
 * search across thousands of records in the browser.
 */
export interface IndexedDoc<T> { id: string; doc: T; tokens: Set<string>; raw: string; }

const trigrams = (s: string): Set<string> => {
  const norm = s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const out = new Set<string>();
  if (!norm) return out;
  for (const word of norm.split(" ")) {
    out.add(word); // also keep whole-word for prefix
    if (word.length < 3) { out.add(word); continue; }
    for (let i = 0; i <= word.length - 3; i++) out.add(word.slice(i, i + 3));
  }
  return out;
};

export class SearchIndex<T> {
  private docs: IndexedDoc<T>[] = [];
  constructor(private readonly fields: (d: T) => string) {}
  rebuild(items: { id: string; doc: T }[]): void {
    this.docs = items.map(({ id, doc }) => {
      const raw = this.fields(doc);
      return { id, doc, raw, tokens: trigrams(raw) };
    });
  }
  search(query: string, limit = 20): { id: string; doc: T; score: number }[] {
    const q = query.trim();
    if (!q) return [];
    const qTok = trigrams(q);
    const qLower = q.toLowerCase();
    const out: { id: string; doc: T; score: number }[] = [];
    for (const d of this.docs) {
      let score = 0;
      for (const t of qTok) if (d.tokens.has(t)) score += 1;
      if (d.raw.toLowerCase().includes(qLower)) score += 5;          // substring bonus
      if (d.raw.toLowerCase().startsWith(qLower)) score += 8;        // prefix bonus
      if (score > 0) out.push({ id: d.id, doc: d.doc, score });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
