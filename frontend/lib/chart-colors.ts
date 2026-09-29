/**
 * Categorical chart palette.
 *
 * design-system.md §"Do Not Use" bans **rainbow categorical color** and any
 * blue / indigo / purple; §2 (Charts) restricts series colour to
 * "teal / `gain` / `loss` + zinc neutrals". `gain`, `loss` and `amber` are
 * *semantic* — a holding drawn in red must mean it is down, never "slice 11" —
 * so a categorical ramp may not borrow them either.
 *
 * What is left, and what this is: a single-hue teal ramp interleaved with zinc
 * neutrals. Alternating the two families keeps adjacent slices separable
 * without reaching for a second hue, and every value stays clearly visible
 * against `vela-bg` (#050A16) per §1 ("no invisible elements") — nothing here
 * is darker than zinc-600.
 *
 * Don't encode meaning by colour alone (§2): these must always sit next to a
 * label or legend.
 */
export const CATEGORICAL_COLORS = [
  "#1AA8BB", // vela-teal — brand accent, always slice 1
  "#D4D4D8", // zinc-300
  "#157E8C", // vela-teal-dim
  "#A1A1AA", // zinc-400
  "#5EBFCC", // teal, light
  "#71717A", // zinc-500
  "#0F5D68", // teal, deep
  "#E4E4E7", // zinc-200
  "#3E9AA8", // teal, mid
  "#52525B", // zinc-600
  "#87C9D3", // teal, pale
  "#8A8A93", // zinc-450 (between 400 and 500)
] as const;

/** Colour for index `i`, wrapping if there are more series than swatches. */
export const categoricalColor = (i: number): string =>
  CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length];
