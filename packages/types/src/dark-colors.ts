import type { Block } from "./blocks";
import type { TemplateContent } from "./template";
import { isSection, isWrapper } from "./guards";

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

function hasAnySet(colors: object | undefined): boolean {
  return (
    colors !== undefined &&
    Object.values(colors).some(
      (value) => typeof value === "string" && isDarkColorSet(value),
    )
  );
}

function blocksHaveDarkColors(blocks: Block[]): boolean {
  return blocks.some((block) => {
    if ("darkColors" in block && hasAnySet(block.darkColors)) {
      return true;
    }
    if (isSection(block)) {
      return block.children.some(blocksHaveDarkColors);
    }
    if (isWrapper(block)) {
      return blocksHaveDarkColors(block.children);
    }
    return false;
  });
}

/**
 * Whether the template, or any block in it, sets at least one dark color.
 * Without one, the rendered email carries no dark-mode CSS and the editor's
 * dark preview falls back to inverting the canvas.
 */
export function hasDarkColors(content: TemplateContent): boolean {
  return (
    hasAnySet(content.settings.darkColors) ||
    blocksHaveDarkColors(content.blocks)
  );
}
