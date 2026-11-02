import type { TemplateContent } from "@templatical/types";
import { hasDarkColors } from "@templatical/types";

/**
 * How the canvas previews dark mode.
 *
 * - `off`: the light email.
 * - `inverted`: the template sets no dark colors, so the canvas inverts its
 *   colors, approximating the automatic recoloring some mail clients apply
 *   to an email that brings no dark theme of its own.
 * - `authored`: the template sets dark colors, so the canvas paints them
 *   where they are set and the light colors everywhere else, as a client
 *   applying the email's own dark-mode CSS does. Inverting on top would turn
 *   the author's dark colors light again.
 */
export type DarkPreview = "off" | "inverted" | "authored";

export function resolveDarkPreview(
  darkMode: boolean,
  content: TemplateContent,
): DarkPreview {
  if (!darkMode) {
    return "off";
  }
  return hasDarkColors(content) ? "authored" : "inverted";
}
