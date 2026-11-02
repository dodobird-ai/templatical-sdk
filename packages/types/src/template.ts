import type { Block } from "./blocks";
import { DEFAULT_TEMPLATE_DEFAULTS } from "./defaults";
import type { TemplateDefaults } from "./defaults";
import type { ContentDirection } from "./direction";
import type { SettingsLocaleLayer } from "./localization";

export interface TemplateSettings {
  width: number;
  backgroundColor: string;
  /**
   * Document-level default text color: the `<mj-text>` default in the rendered
   * MJML, inherited by every text block (Title, Paragraph, Menu, Table) that
   * doesn't set its own `color`. Required, defaulting to `#1a1a1a` (see
   * `DEFAULT_TEMPLATE_DEFAULTS`); customize the default per-consumer via
   * `templateDefaults`. A block's explicit `color` or an inline text-color
   * mark overrides it.
   */
  textColor: string;
  /**
   * Document-level link color: emitted as the global `a { color }` rule in the
   * rendered MJML, so it cascades to every link — rich-text and menu alike.
   * Optional: when unset, links inherit the surrounding text color
   * (`color: inherit`), preserving the pre-#352 default. A per-block or
   * per-item color (a Menu item's `color`, `MenuBlock.linkColor`) still
   * overrides it.
   */
  linkColor?: string;
  /**
   * Whether links are underlined document-wide: drives the global
   * `a { text-decoration }` rule (`underline` when true, `none` when false).
   * Required, defaulting to `true` (see `DEFAULT_TEMPLATE_DEFAULTS`) — the
   * common, more accessible email default. Applies to body (rich-text) links;
   * buttons and menu items carry their own inline `text-decoration` and are
   * unaffected. Set `false` to render links without an underline.
   */
  linkUnderline: boolean;
  fontFamily: string;
  preheaderText?: string;
  /**
   * BCP-47 language code for the rendered email's `<html lang>`. Drives
   * screen-reader pronunciation. Default `'en'` via `DEFAULT_TEMPLATE_DEFAULTS`.
   */
  locale: string;
  /** Other language versions; the default is `locale`. */
  locales?: string[];
  /** Per-language layers, keyed by BCP 47 tag; see `resolveLocale`. */
  l10n?: Record<string, SettingsLocaleLayer>;
  /**
   * Writing direction of the delivered email: the canvas `dir` and the
   * rendered `<mjml dir>`. Independent of the editor chrome
   * (`init({ locale })`). Optional: when unset, `resolveContentDirection`
   * falls through to the content language (`ar` / `he` / `fa` / … → `"rtl"`,
   * otherwise `"ltr"`). An explicit `"ltr"` on an Arabic template is a
   * stated decision, not a missing value.
   */
  direction?: ContentDirection;
  /**
   * Custom head CSS: author CSS emitted as its own `<mj-style>` at the end of
   * `<mj-head>`, after every built-in rule, so it wins ties in the cascade. It
   * is not inlined, and the editor canvas never applies it. Unset or blank
   * renders nothing. A value containing `<` is left out of the render whole
   * (see `checkCustomHeadCss`).
   */
  customHeadCss?: string;
  /**
   * Custom head tags: raw markup (`<meta>`, `<link>`, `<style>`, Outlook
   * conditional comments) emitted inside an `<mj-raw>` at the end of
   * `<mj-head>`, so it reaches the compiled `<head>` unchanged. Unset or blank
   * renders nothing. A value with `<script>`, an `on*` attribute, an `mj-*`
   * tag or another refused construct is left out of the render whole (see
   * `checkCustomHeadTags`).
   */
  customHeadTags?: string;
}

export interface TemplateContent {
  blocks: Block[];
  settings: TemplateSettings;
}

export function createDefaultTemplateContent(
  defaultFontFamily = "Arial",
  templateDefaults?: TemplateDefaults,
): TemplateContent {
  return {
    blocks: [],
    settings: {
      ...DEFAULT_TEMPLATE_DEFAULTS,
      fontFamily: defaultFontFamily,
      ...templateDefaults,
    } as TemplateSettings,
  };
}
