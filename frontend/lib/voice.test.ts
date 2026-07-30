/**
 * Design-system voice invariants, enforced across the whole frontend source.
 *
 * design-system.md §8 bans two punctuation tells in visible UI copy, and both
 * kept coming back because they were style rules nobody could run:
 *
 *  1. **Em/en dashes.** The ONE sanctioned use is the null-value placeholder
 *     ("—" on its own). Anywhere else it is the #1 AI-writing tell. This has
 *     now been fixed four separate times (Section asides on guide/news/
 *     watchlist/portfolio, then GoalDetailPanel, then the legal page titles,
 *     then two ternary branches in the screener that the earlier greps missed
 *     because they sat on continuation lines).
 *  2. **The "  - " doubled space before a hyphen** — the residue of a bulk
 *     em-dash replacement. A single spaced hyphen " - " is sanctioned; the
 *     doubled space is not, and 103 of them were still in the tree.
 *
 * Scanning source is cruder than a lint rule, but it is free, it runs in the
 * existing `npm test`, and it covers every page and component rather than the
 * handful of lib modules a unit test can reach.
 *
 * EXCLUDED, deliberately:
 *  - `app/(legal)/**` — the GDPR privacy policy and terms are legal prose,
 *    where an em-dash is normal register. Reformatting a compliance document
 *    for house style is a decision for the owner, not a lint rule.
 *  - `*.test.ts` — these files quote the banned patterns on purpose.
 *  - comment lines — JSDoc bullets and rules use both patterns legitimately.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIRS = ["app", "components", "lib"];
const EXCLUDED_DIR_PATTERN = /\(legal\)/;

function sourceFiles(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      if (!EXCLUDED_DIR_PATTERN.test(full)) acc.push(full);
    }
  }
  return acc;
}

const FILES = SCAN_DIRS.flatMap((d) => sourceFiles(join(ROOT, d)));

/** A whole-line comment: JSDoc, //, /* or a JSX {/* block. */
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*|\{\/\*)/;

/**
 * Reduce a file to just its user-visible copy, so the dash rules apply to
 * rendered text only. Removes:
 *  - block comments, tracked ACROSS lines (a `{/* ... *\/}` JSX block spanning
 *    several lines has continuation lines that look like plain prose)
 *  - trailing `// ...`
 *  - regex character classes, because the sanitisers that STRIP em-dashes
 *    (`stripAiMarkdown` in formatters.ts, the source-prefix trim in
 *    DailyDebrief) necessarily contain one.
 * Over-stripping can only hide a violation, never invent one.
 */
function stripComments(lines: string[]): string[] {
  let inBlock = false;
  return lines.map((raw) => {
    let line = raw;
    if (inBlock) {
      const close = line.indexOf("*/");
      if (close === -1) return "";
      line = line.slice(close + 2);
      inBlock = false;
    }
    line = line.replace(/\/\*.*?\*\//g, "");
    const open = line.indexOf("/*");
    if (open !== -1) {
      inBlock = true;
      line = line.slice(0, open);
    }
    return line.replace(/\/\/.*$/, "").replace(/\[[^\]]*[—–][^\]]*\]/g, "");
  });
}

/**
 * The sanctioned null placeholder, in any quoting style. Stripping these first
 * lets the assertion below flag every *other* dash without special-casing.
 */
const PLACEHOLDER = /(["'`])\s*[—–]\s*\1/g;

interface Violation {
  file: string;
  line: number;
  text: string;
}

function scan(pattern: RegExp, opts: { stripPlaceholder?: boolean } = {}): Violation[] {
  const found: Violation[] = [];
  for (const file of FILES) {
    const raw = readFileSync(file, "utf8").split("\n");
    const stripped = stripComments(raw);
    stripped.forEach((code, i) => {
      if (COMMENT_LINE.test(raw[i])) return;
      const line = opts.stripPlaceholder ? code.replace(PLACEHOLDER, "") : code;
      if (pattern.test(line)) {
        found.push({ file: relative(ROOT, file), line: i + 1, text: raw[i].trim().slice(0, 120) });
      }
    });
  }
  return found;
}

function report(violations: Violation[]): string {
  return violations.map((v) => `\n  ${v.file}:${v.line}  ${v.text}`).join("");
}

describe("design-system voice invariants (§8)", () => {
  it("scans a meaningful number of source files", () => {
    // Guards the guard: a broken path resolution would silently pass everything.
    expect(FILES.length).toBeGreaterThan(50);
  });

  it("uses no em/en dash outside the null-value placeholder", () => {
    const violations = scan(/[—–]/, { stripPlaceholder: true });
    expect(
      violations,
      `Em/en dash is banned in visible copy (§8). The only allowed use is the ` +
        `standalone null placeholder "—". Use a period, comma, colon, or a ` +
        `spaced hyphen " - " instead.${report(violations)}\n`,
    ).toEqual([]);
  });

  it('uses no doubled space before a hyphen ("  - ")', () => {
    // Anchored on a preceding non-space so JSX indentation before a rendered
    // minus sign ("      - {formatCurrency(v)}") is not mistaken for a separator.
    const violations = scan(/\S {2}- /);
    expect(
      violations,
      `"  - " is the residue of a bulk em-dash replacement. §8 sanctions a ` +
        `single spaced hyphen " - ".${report(violations)}\n`,
    ).toEqual([]);
  });
});
