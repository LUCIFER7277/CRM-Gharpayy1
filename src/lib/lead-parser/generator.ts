// Pattern-variant generator. Combines base lexicons into 30k+ phrase variants.
// Used (a) at build/test time to QA coverage, (b) at runtime to expose
// `searchAcrossExamples()` for the "show me an example like this" UX.
//
// At MATCH time the runtime parser uses the compact regex/lexicon directly -
// it never iterates 30k strings.

import {
  FIELD_LABELS, type FieldKey,
  ALL_LOCALITIES, COMMON_NAMES, INTENT_WORDS,
} from "./lexicon";

export interface ExampleEntry {
  text: string;
  field: FieldKey | "intent" | "locality" | "name" | "fullExample";
  expectedValue?: string;
}

const SEPARATORS = [": ", " - ", " – ", " : ", "= ", " is ", " - ", "  "];
const SUFFIXES = ["", ".", " ", "  ", " !"];
const PREFIXES = ["", "Hi, ", "Hello, ", "Hi team, ", "FYI: ", "Lead: ", "New: ", "* ", "- "];

function combine(parts: string[][]): string[] {
  let out: string[] = [""];
  for (const p of parts) {
    const next: string[] = [];
    for (const o of out) for (const x of p) next.push(o + x);
    out = next;
  }
  return out;
}

/**
 * Generates label-value variants like "Name: Rahul", "name - rahul",
 * "Mob no = 9876543210", etc.
 */
export function generateLabelVariants(field: FieldKey, sampleValues: string[]): ExampleEntry[] {
  const labels = FIELD_LABELS[field];
  const out: ExampleEntry[] = [];
  for (const lbl of labels) {
    for (const sep of SEPARATORS) {
      for (const val of sampleValues) {
        for (const suf of SUFFIXES) {
          out.push({ text: `${lbl}${sep}${val}${suf}`, field, expectedValue: val });
          out.push({ text: `${lbl.toUpperCase()}${sep}${val}${suf}`, field, expectedValue: val });
        }
      }
    }
  }
  return out;
}

/** Generates standalone-context examples (no label) like "looking in Koramangala". */
export function generateContextVariants(): ExampleEntry[] {
  const out: ExampleEntry[] = [];

  // Locality phrases
  const locVerbs = ["looking in ", "wants ", "interested in ", "near ", "around ", "site at ", "needs flat in "];
  for (const v of locVerbs) {
    for (const loc of ALL_LOCALITIES) {
      for (const pre of PREFIXES) {
        out.push({ text: `${pre}${v}${loc}`, field: "area", expectedValue: loc });
      }
    }
  }

  // Intent phrases mixed with locality
  for (const k of ["hot", "warm", "cold"] as const) {
    for (const word of INTENT_WORDS[k]) {
      for (const loc of ALL_LOCALITIES.slice(0, 30)) {
        out.push({ text: `${word}, looking in ${loc}`, field: "intent", expectedValue: k });
      }
    }
  }

  // Name + phone + locality combos (full lead examples)
  const phoneSamples = ["9876543210", "+91 98765 43210", "98765-43210", "8123456789"];
  for (const name of COMMON_NAMES.slice(0, 40)) {
    for (const phone of phoneSamples) {
      for (const loc of ALL_LOCALITIES.slice(0, 25)) {
        out.push({ text: `${name} ${phone} looking for 2BHK in ${loc} budget 25k move in next week`, field: "fullExample" });
      }
    }
  }

  return out;
}

let CACHE: ExampleEntry[] | null = null;
export function buildAllExamples(): ExampleEntry[] {
  if (CACHE) return CACHE;
  const out: ExampleEntry[] = [];
  out.push(...generateLabelVariants("name", ["Rahul Sharma", "Anjali", "Vikas Kumar", "Priya Reddy"]));
  out.push(...generateLabelVariants("phone", ["9876543210", "+91 98765 43210", "8123456789"]));
  out.push(...generateLabelVariants("email", ["rahul@gmail.com", "priya.k@yahoo.in"]));
  out.push(...generateLabelVariants("budget", ["25k", "₹25,000", "1.2L per month", "Rs 18000", "30000"]));
  out.push(...generateLabelVariants("area", ["Koramangala", "HSR Layout", "Whitefield", "Indiranagar"]));
  out.push(...generateLabelVariants("bhk", ["2BHK", "1RK", "Studio", "3 BHK"]));
  out.push(...generateLabelVariants("moveIn", ["next week", "01 Jan 2026", "tomorrow", "in 5 days"]));
  out.push(...generateLabelVariants("source", ["WhatsApp", "99acres", "Housing.com"]));
  out.push(...generateContextVariants());
  CACHE = out;
  return out;
}

export function exampleCount(): number { return buildAllExamples().length; }
