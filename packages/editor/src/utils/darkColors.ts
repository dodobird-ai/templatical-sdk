import type {
  Block,
  DarkColorField,
  DarkColorsBlock,
  TemplateDarkColors,
} from "@templatical/types";
import { isDarkColorSet } from "@templatical/types";

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

/** The dark colors `block` offers, or `null` for a type that has none. */
export function darkColorFieldsFor(
  block: Block,
): readonly DarkColorField[] | null {
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

/**
 * `colors` with `field` set to `value`, or without it when `value` is empty
 * (a cleared picker). `undefined` once nothing is left, so a block whose dark
 * colors are all cleared stores no `darkColors` and renders as before.
 */
export function withDarkColor(
  colors: TemplateDarkColors | undefined,
  field: DarkColorField,
  value: string,
): TemplateDarkColors | undefined {
  const next: TemplateDarkColors = { ...colors };
  if (isDarkColorSet(value)) {
    next[field] = value;
  } else {
    delete next[field];
  }
  return Object.values(next).some(isDarkColorSet) ? next : undefined;
}
