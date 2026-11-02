import type {
  Block,
  DarkColorField,
  DarkColorsBlock,
} from "@templatical/types";
import { canHaveDarkColors, isDarkColorSet } from "@templatical/types";

type DarkColorsBlockType = DarkColorsBlock["type"];

type FieldsOf<T extends DarkColorsBlockType> = keyof NonNullable<
  Extract<DarkColorsBlock, { type: T }>["darkColors"]
>;

/**
 * Which dark colors each block type offers, in display order. Keyed by every
 * block type whose model carries `darkColors`, so a new one fails to compile
 * here until it is given its fields.
 */
export const DARK_COLOR_FIELDS: {
  readonly [T in DarkColorsBlockType]: readonly FieldsOf<T>[];
} = {
  section: ["backgroundColor"],
  title: ["textColor", "backgroundColor"],
  paragraph: ["textColor", "backgroundColor"],
  button: ["backgroundColor", "textColor"],
};

/** The dark colors the template settings offer, in display order. */
export const TEMPLATE_DARK_COLOR_FIELDS: readonly DarkColorField[] = [
  "backgroundColor",
  "textColor",
  "linkColor",
];

/** The dark colors `block` offers, or `null` when it can have none. */
export function darkColorFieldsFor(
  block: Block,
): (typeof DARK_COLOR_FIELDS)[DarkColorsBlockType] | null {
  // A hero section is left out: its image covers the box and the email
  // gives it no dark background, so a picker there would do nothing.
  if (!canHaveDarkColors(block)) return null;
  switch (block.type) {
    case "section":
    case "title":
    case "paragraph":
    case "button":
      return DARK_COLOR_FIELDS[block.type];
    default:
      return null;
  }
}

/** Whether `block` sets at least one dark color of its own. */
export function setsDarkColor(block: Block): boolean {
  return (
    "darkColors" in block &&
    block.darkColors !== undefined &&
    Object.values(block.darkColors).some(isDarkColorSet)
  );
}

/**
 * `colors` with `field` set to `value`, or without it when `value` is empty
 * (a cleared picker). `undefined` once nothing is left, so a block whose dark
 * colors are all cleared stores no `darkColors` and renders as before. Only
 * fields of `F` are ever written, so a section's fields cannot gain a link
 * color.
 */
export function withDarkColor<F extends DarkColorField>(
  colors: Partial<Record<F, string>> | undefined,
  field: F,
  value: string,
): Partial<Record<F, string>> | undefined {
  const next: Partial<Record<F, string>> = { ...colors };
  if (isDarkColorSet(value)) {
    next[field] = value;
  } else {
    delete next[field];
  }
  return Object.values<string | undefined>(next).some(isDarkColorSet)
    ? next
    : undefined;
}
