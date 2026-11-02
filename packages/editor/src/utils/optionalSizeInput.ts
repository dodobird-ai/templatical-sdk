/**
 * What a number field for an optional size (one a block may leave to a
 * default) holds at a given keystroke.
 *
 * - `size`: a usable value, to store on the block.
 * - `clear`: the field was emptied, so the block goes back to its default.
 * - `typing`: an unfinished or unusable entry; the stored value stays.
 */
export type OptionalSizeEntry =
  { kind: "size"; value: number } | { kind: "clear" } | { kind: "typing" };

/**
 * Read an optional-size number field.
 *
 * A number input reports unparseable in-progress content (`1.` in some
 * browsers, a lone `-`) as an empty string with `badInput` set, which must not
 * be mistaken for the user emptying the field. Zero and negatives are never a
 * usable font size or line height, and `0` is how `0.9` starts, so they wait
 * too.
 */
export function readOptionalSize(field: {
  value: string;
  badInput: boolean;
}): OptionalSizeEntry {
  if (field.badInput) return { kind: "typing" };
  if (field.value.trim() === "") return { kind: "clear" };
  const value = Number(field.value);
  return Number.isFinite(value) && value > 0
    ? { kind: "size", value }
    : { kind: "typing" };
}
