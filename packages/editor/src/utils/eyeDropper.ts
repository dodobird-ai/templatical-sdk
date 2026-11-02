import { opaqueHex } from "./color";

/**
 * The slice of the browser EyeDropper API the color picker uses
 * (https://wicg.github.io/eyedropper-api/). Declared here because TypeScript's
 * DOM lib does not ship it: only Chromium-based browsers implement it.
 */
export interface EyeDropperLike {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
}

export type EyeDropperConstructor = new () => EyeDropperLike;

/**
 * What one eyedropper session ended with. `picked` carries the color already
 * in the picker's `#rrggbb` form; `cancelled` is the user pressing Escape (or
 * the picker aborting the session), which changes nothing; `failed` is any
 * other rejection, kept so the caller can report it.
 */
export type EyeDropperOutcome =
  | { readonly kind: "picked"; readonly hex: string }
  | { readonly kind: "cancelled" }
  | { readonly kind: "failed"; readonly error: unknown };

/**
 * The EyeDropper constructor the given global exposes, or null where the API
 * is unsupported (Firefox, Safari, server-side rendering). The picker hides
 * its eyedropper button on null.
 */
export function resolveEyeDropper(
  scope: object | undefined,
): EyeDropperConstructor | null {
  if (scope === undefined || !("EyeDropper" in scope)) return null;
  const candidate: unknown = scope.EyeDropper;
  // The one unchecked step: a runtime `typeof` can prove "callable", not the
  // constructor's shape. The API is spec-defined, so callable is enough.
  return typeof candidate === "function"
    ? (candidate as EyeDropperConstructor)
    : null;
}

/**
 * A cancel is recognised by its `name` alone, not by `instanceof`: a
 * DOMException from another realm (an iframe's EyeDropper) fails a prototype
 * check yet is still the author pressing Escape.
 */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

/**
 * Classify a finished eyedropper session. The spec's `sRGBHex` is `#rrggbb`,
 * but early Chromium builds returned `rgb(...)`/`rgba(...)`, so the value goes
 * through the same normalization the picker uses for stored colors. A value
 * that is neither is reported as `failed` rather than emitted.
 */
export function toEyeDropperOutcome(
  settled: PromiseSettledResult<{ sRGBHex: string }>,
): EyeDropperOutcome {
  if (settled.status === "rejected") {
    const error: unknown = settled.reason;
    return isAbortError(error)
      ? { kind: "cancelled" }
      : { kind: "failed", error };
  }
  const hex = opaqueHex(settled.value.sRGBHex);
  return hex === null
    ? {
        kind: "failed",
        error: new TypeError(
          `EyeDropper returned an unreadable color: "${settled.value.sRGBHex}"`,
        ),
      }
    : { kind: "picked", hex };
}

/**
 * Run one eyedropper session. Must be called from a user gesture (a click
 * handler): browsers reject `open()` without transient activation. Never
 * rejects; every ending is an {@link EyeDropperOutcome}.
 */
export async function pickWithEyeDropper(
  EyeDropper: EyeDropperConstructor,
  signal?: AbortSignal,
): Promise<EyeDropperOutcome> {
  const [settled] = await Promise.allSettled([
    // Invoked inside the array so a synchronous throw from the constructor or
    // `open()` still settles as a rejection instead of escaping.
    (async () => new EyeDropper().open({ signal }))(),
  ]);
  return toEyeDropperOutcome(settled);
}
