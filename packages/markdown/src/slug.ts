import type { Maybe, TocEntry } from "./types.ts";
import { NONE } from "./maybe.ts";

const NON_WORD = /[^\w\s-]/gu;
const WHITESPACE = /\s+/gu;
const H2 = 2;
const H3 = 3;

/** A heading slug: lowercase, spaces → "-", non-word stripped (the anchor id). */
const slug = (text: string): string =>
  text.toLowerCase().replaceAll(NON_WORD, "").trim().replaceAll(WHITESPACE, "-");

/** A per-page unique slug maker: empty (e.g. non-Latin) headings fall back to "section"; repeats get -1/-2. */
function makeUniqueSlug(): (text: string) => string {
  const used = new Set<string>();
  return (text: string): string => {
    const base = slug(text) || "section";
    let candidate = base;
    for (let suffix = 1; used.has(candidate); suffix += 1) {
      candidate = `${base}-${suffix}`;
    }
    used.add(candidate);
    return candidate;
  };
}

/** Records an h2/h3 heading: returns its anchor id (and appends a TOC entry), or absence otherwise. */
export type Recorder = (level: number, text: string) => Maybe<string>;

/**
 * Build the "on this page" recorder over the caller's output array. Each h2/h3 gets a unique slug id (the
 * element anchor) and a TOC entry appended to `sink`; other levels — or no sink — record nothing. The
 * mutable `sink` is closed over here (the single API-contract output site), so the renderer passes only a
 * plain function around.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `sink` is the caller's output array by API contract; the recorder appends each heading entry into it.
export function makeRecorder(sink?: Maybe<TocEntry[]>): Recorder {
  const uniqueSlug = makeUniqueSlug();
  return (level, text) => {
    if (!sink || (level !== H2 && level !== H3)) {
      return NONE;
    }
    const id = uniqueSlug(text);
    sink.push({ level, slug: id, text });
    return id;
  };
}
