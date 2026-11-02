import type { Block } from "./blocks";
import type { TemplateContent } from "./template";
import { isSection, isWrapper } from "./guards";
import { resolveHero } from "./hero";

/**
 * Colors a text block (title, paragraph) uses when the reader's mail client
 * is in dark mode. Each field overrides its light counterpart only in dark
 * mode; an absent or empty field leaves the light color in place.
 */
export interface TextDarkColors {
  /** Replaces `styles.backgroundColor`. */
  backgroundColor?: string;
  /**
   * Replaces the block's text color, inline text colors included. Links take
   * it too, unless the template sets a dark `linkColor`.
   */
  textColor?: string;
}

/** Colors a button uses when the reader's mail client is in dark mode. */
export interface ButtonDarkColors {
  /** Replaces the button's fill, `ButtonBlock.backgroundColor`. */
  backgroundColor?: string;
  /** Replaces the button's label color, `ButtonBlock.textColor`. */
  textColor?: string;
}

/** Colors a section uses when the reader's mail client is in dark mode. */
export interface SectionDarkColors {
  /**
   * Replaces `styles.backgroundColor` behind the section's columns. A
   * background image still paints over it. Not applied to a hero.
   */
  backgroundColor?: string;
}

/** Colors the whole template uses when the reader's mail client is in dark mode. */
export interface TemplateDarkColors {
  /** Replaces `settings.backgroundColor`, the email body. */
  backgroundColor?: string;
  /**
   * Replaces the text color of every title and paragraph, inline text
   * colors included. A block's own dark `textColor` wins over it.
   */
  textColor?: string;
  /** Replaces the color of links in titles and paragraphs. */
  linkColor?: string;
}

/** A block type that can carry dark colors. */
export type DarkColorsBlock = Extract<Block, { darkColors?: unknown }>;

/** One dark color field. */
export type DarkColorField = keyof TemplateDarkColors;

/**
 * Whether a dark color is set. An empty or whitespace-only string is how a
 * cleared color picker stores "no color", so it counts as unset.
 */
export function isDarkColorSet(color: string | undefined): color is string {
  return typeof color === "string" && color.trim() !== "";
}

/** Whether any field of a dark color set is set. */
function hasAnySet(
  colors: Partial<Record<DarkColorField, string>> | undefined,
): boolean {
  return colors !== undefined && Object.values(colors).some(isDarkColorSet);
}

/**
 * Whether `block`'s own dark colors can reach the email. A hero section takes
 * none: its image paints over the whole box. The editor offers no dark colors
 * where this is false, so an author never sets one that does nothing.
 *
 * A plain boolean, not a type guard: a guard's false branch would claim a
 * hero is not a section.
 */
export function canHaveDarkColors(block: Block): boolean {
  switch (block.type) {
    case "title":
    case "paragraph":
    case "button":
      return true;
    case "section":
      return !resolveHero(block)?.applied;
    default:
      return false;
  }
}

function isHiddenEverywhere(block: Block): boolean {
  return (
    block.visibility !== undefined &&
    !block.visibility.desktop &&
    !block.visibility.mobile
  );
}

/**
 * The blocks whose dark colors reach the email, in document order: every
 * block that {@link canHaveDarkColors} and sets one, skipping any block hidden
 * on every viewport together with its children, as the renderer skips them.
 * The renderer builds its dark-mode CSS from exactly these blocks, so the
 * email has dark-mode CSS if and only if {@link hasDarkColors} says so.
 */
export function darkColorSources(blocks: readonly Block[]): DarkColorsBlock[] {
  return blocks.flatMap((block): DarkColorsBlock[] => {
    if (isHiddenEverywhere(block)) {
      return [];
    }
    const own =
      "darkColors" in block &&
      canHaveDarkColors(block) &&
      hasAnySet(block.darkColors)
        ? [block]
        : [];
    if (isSection(block)) {
      return [...own, ...block.children.flatMap(darkColorSources)];
    }
    if (isWrapper(block)) {
      return [...own, ...darkColorSources(block.children)];
    }
    return own;
  });
}

/**
 * Whether the template, or any block in it, sets a dark color that reaches
 * the email (see {@link darkColorSources}). Without one, the rendered email
 * carries no dark-mode CSS and the editor's dark preview falls back to
 * inverting the canvas.
 */
export function hasDarkColors(content: TemplateContent): boolean {
  return (
    hasAnySet(content.settings.darkColors) ||
    darkColorSources(content.blocks).length > 0
  );
}
