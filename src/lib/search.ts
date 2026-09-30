/**
 * Small, dependency-free text search used by the command palette and the
 * collection search box.
 *
 * Matching is case- and accent-insensitive ("cafe" finds "Café"). A query is
 * split on whitespace and every term must appear somewhere in the record
 * (AND). Records are ranked by where the terms appear (title beats subtitle
 * beats body) and how well (exact > prefix > word start > anywhere).
 */
import type { Folder, Note } from "@/contexts/JournalContext";

const COMBINING_MARKS = /\p{M}/gu;

/** Lower-case and strip accents. */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

interface MappedText {
  /** Normalized text. */
  norm: string;
  /** For each index in `norm`, the index of the source character in the original text. */
  map: number[];
}

/** Normalize while keeping a mapping back to the original indices (for highlighting). */
function normalizeWithMap(text: string): MappedText {
  let norm = "";
  const map: number[] = [];
  let index = 0;
  for (const char of text) {
    const n = normalizeText(char);
    for (let i = 0; i < n.length; i++) map.push(index);
    norm += n;
    index += char.length;
  }
  return { norm, map };
}

/** Normalized, de-duplicated query terms, longest first. */
export function tokenize(query: string): string[] {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  return [...new Set(terms)].sort((a, b) => b.length - a.length);
}

export type MatchRange = [start: number, end: number];

/** Ranges (in the original string) where any term occurs, merged and sorted. */
export function findMatchRanges(text: string, terms: string[]): MatchRange[] {
  if (!text || terms.length === 0) return [];
  const { norm, map } = normalizeWithMap(text);
  const ranges: MatchRange[] = [];
  for (const term of terms) {
    let from = 0;
    while (from <= norm.length - term.length) {
      const at = norm.indexOf(term, from);
      if (at === -1) break;
      const start = map[at];
      const lastSource = map[at + term.length - 1];
      // Include the full (possibly surrogate-pair) last source character.
      const end = lastSource + (text.codePointAt(lastSource)! > 0xffff ? 2 : 1);
      ranges.push([start, end]);
      from = at + term.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: MatchRange[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

export interface SearchField {
  /** Already normalized text (see normalizeText). */
  value: string;
  weight: number;
}

function isWordStart(text: string, index: number): boolean {
  return index === 0 || /[^\p{L}\p{N}]/u.test(text[index - 1]);
}

/** How well one term matches one normalized field (0 = no match). */
function termFieldScore(term: string, field: string): number {
  const at = field.indexOf(term);
  if (at === -1) return 0;
  if (field === term) return 4;
  if (at === 0) return 3;
  if (isWordStart(field, at)) return 2;
  // Look for a later word-start occurrence before settling for "anywhere".
  let next = field.indexOf(term, at + 1);
  while (next !== -1) {
    if (isWordStart(field, next)) return 2;
    next = field.indexOf(term, next + 1);
  }
  return 1;
}

/**
 * Score a record against query terms. Returns null when any term is missing
 * from every field, otherwise a positive score (higher is better).
 */
export function scoreFields(terms: string[], fields: SearchField[]): number | null {
  if (terms.length === 0) return 0;
  let total = 0;
  for (const term of terms) {
    let best = 0;
    for (const field of fields) {
      if (!field.value) continue;
      const s = termFieldScore(term, field.value) * field.weight;
      if (s > best) best = s;
    }
    if (best === 0) return null;
    total += best;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Plain text from note HTML (cached: notes are re-parsed only when they change)

const plainTextCache = new Map<string, string>();
const PLAIN_TEXT_CACHE_LIMIT = 1000;

/** Plain text of an HTML string, with whitespace collapsed. Never renders markup. */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  const cached = plainTextCache.get(html);
  if (cached !== undefined) return cached;
  let text: string;
  try {
    // Put block boundaries back as spaces so words in adjacent paragraphs don't merge.
    const spaced = html.replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>|<br\s*\/?>/gi, "$& ");
    text = new DOMParser().parseFromString(spaced, "text/html").body.textContent ?? "";
  } catch {
    text = html.replace(/<[^>]*>/g, " ");
  }
  text = text.replace(/\s+/g, " ").trim();
  if (plainTextCache.size >= PLAIN_TEXT_CACHE_LIMIT) plainTextCache.clear();
  plainTextCache.set(html, text);
  return text;
}

/**
 * A short excerpt of `text` around the first match of any term, cut on word
 * boundaries with ellipses. Falls back to the start of the text.
 */
export function makeSnippet(text: string, terms: string[], length = 140): string {
  if (!text) return "";
  const ranges = findMatchRanges(text, terms);
  if (text.length <= length) return text;
  const hit = ranges[0]?.[0] ?? 0;
  let start = Math.max(0, hit - Math.floor(length / 3));
  let end = Math.min(text.length, start + length);
  start = Math.max(0, end - length);
  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space !== -1 && space < hit) start = space + 1;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end);
    if (space > hit) end = space;
  }
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

// ---------------------------------------------------------------------------
// Journal search (shared by the command palette and CollectionPage)

export interface IndexedNote {
  note: Note;
  /** Plain text of the note body. */
  text: string;
  fields: SearchField[];
}

/** Precompute normalized fields for every note. Memoize the result on `notes`. */
export function indexNotes(notes: Note[]): IndexedNote[] {
  return notes.map((note) => {
    const text = htmlToPlainText(note.content);
    return {
      note,
      text,
      fields: [
        { value: normalizeText(note.title || ""), weight: 10 },
        { value: normalizeText(note.subtitle || ""), weight: 5 },
        { value: normalizeText(text), weight: 1 },
      ],
    };
  });
}

export interface NoteSearchResult {
  note: Note;
  score: number;
  /** Excerpt of the body around the first match (or its beginning). */
  snippet: string;
}

function noteTime(note: Note): number {
  const t = Date.parse(note.updated_at || note.created_at);
  return Number.isNaN(t) ? 0 : t;
}

export function searchNotes(
  index: IndexedNote[],
  query: string,
  limit = Infinity
): NoteSearchResult[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const results: NoteSearchResult[] = [];
  for (const entry of index) {
    const score = scoreFields(terms, entry.fields);
    if (score === null) continue;
    results.push({ note: entry.note, score, snippet: "" });
  }
  results.sort((a, b) => b.score - a.score || noteTime(b.note) - noteTime(a.note));
  const top = results.slice(0, limit);
  const byNote = new Map(index.map((entry) => [entry.note, entry.text]));
  for (const result of top) {
    result.snippet = makeSnippet(byNote.get(result.note) ?? "", terms);
  }
  return top;
}

export interface FolderSearchResult {
  folder: Folder;
  score: number;
}

export function searchFolders(
  folders: Folder[],
  query: string,
  limit = Infinity
): FolderSearchResult[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const results: FolderSearchResult[] = [];
  for (const folder of folders) {
    const score = scoreFields(terms, [{ value: normalizeText(folder.name), weight: 10 }]);
    if (score !== null) results.push({ folder, score });
  }
  results.sort((a, b) => b.score - a.score || a.folder.name.localeCompare(b.folder.name));
  return results.slice(0, limit);
}

/** Generic helper: rank arbitrary items by a set of weighted text fields. */
export function searchItems<T>(
  items: T[],
  query: string,
  getFields: (item: T) => { value: string; weight: number }[],
  limit = Infinity
): T[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const scored: { item: T; score: number; order: number }[] = [];
  items.forEach((item, order) => {
    const fields = getFields(item).map((f) => ({
      value: normalizeText(f.value || ""),
      weight: f.weight,
    }));
    const score = scoreFields(terms, fields);
    if (score !== null) scored.push({ item, score, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.slice(0, limit).map((s) => s.item);
}
