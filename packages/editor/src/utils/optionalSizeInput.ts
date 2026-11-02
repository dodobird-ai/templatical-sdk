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
 * Which numbers a field takes: `whole` for a px size (`31`, not `31.5`), `any`
 * for a multiple such as a line height (`1.15`).
 */
export type SizeGrain = "whole" | "any";

/**
 * Read an optional-size number field.
 *
 * A number input reports unparseable in-progress content (`1.` in some
 * browsers, a lone `-`) as an empty string with `badInput` set, which must not
 * be mistaken for the user emptying the field. Zero and negatives are never a
 * usable font size or line height, and `0` is how `0.9` starts, so they wait
 * too, as does a fraction in a field of whole numbers.
 */
export function readOptionalSize(
  field: { value: string; badInput: boolean },
  grain: SizeGrain,
): OptionalSizeEntry {
  if (field.badInput) return { kind: "typing" };
  if (field.value.trim() === "") return { kind: "clear" };
  const value = Number(field.value);
  const usable =
    Number.isFinite(value) &&
    value > 0 &&
    (grain === "any" || Number.isInteger(value));
  return usable ? { kind: "size", value } : { kind: "typing" };
}
