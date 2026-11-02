// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import type { TemplateSettings } from "@templatical/types";
import TemplateSettingsPanel from "../src/components/TemplateSettings.vue";
import {
  FONTS_MANAGER_KEY,
  TEMPLATE_SETTINGS_FIELDS_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import en from "../src/i18n/locales/en";
import type { TemplateSettingsField } from "../src/utils/templateSettingsFields";
import { ALL_TEMPLATE_SETTINGS_FIELDS } from "../src/utils/templateSettingsFields";
import { mountEditor } from "./helpers/mount";

/**
 * The Custom head card: a CSS textarea and a head-tags textarea. The verdict of
 * `checkCustomHeadCss` / `checkCustomHeadTags` shows under each one as the
 * author types; the setting itself is written on `change`, once per edit, and
 * is stored as typed even when refused so the author can fix it.
 */

function makeSettings(
  overrides: Partial<TemplateSettings> = {},
): TemplateSettings {
  return {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    linkUnderline: true,
    fontFamily: "Arial",
    locale: "en",
    ...overrides,
  };
}

const fontsManager = {
  fonts: ref([{ label: "Default", value: "Arial" }]),
  defaultFont: ref("Arial"),
  loadCustomFonts: async () => {},
  cleanupFontLinks: () => {},
  setCustomFontsEnabled: () => {},
};

function mountPanel(
  settings: TemplateSettings = makeSettings(),
  fields?: TemplateSettingsField[],
) {
  return mountEditor(TemplateSettingsPanel, {
    props: { settings },
    provides: {
      // Real English: the refusal messages are part of what is under test.
      [TRANSLATIONS_KEY]: en,
      [FONTS_MANAGER_KEY]: fontsManager,
      ...(fields === undefined
        ? {}
        : { [TEMPLATE_SETTINGS_FIELDS_KEY]: new Set(fields) }),
    },
  });
}

type Wrapper = ReturnType<typeof mountPanel>;

function field(wrapper: Wrapper, name: "css" | "tags") {
  return wrapper.find(`[data-testid="template-settings-custom-head-${name}"]`);
}

function textarea(wrapper: Wrapper, name: "css" | "tags") {
  const element = field(wrapper, name).find("textarea");
  expect(element.exists()).toBe(true);
  return element;
}

/** Type into a textarea: an `input` event only, as a keystroke fires. */
async function type(wrapper: Wrapper, name: "css" | "tags", value: string) {
  const element = textarea(wrapper, name);
  (element.element as HTMLTextAreaElement).value = value;
  await element.trigger("input");
  return element;
}

function refusal(wrapper: Wrapper, name: "css" | "tags"): string | null {
  const element = field(wrapper, name).find(
    '[data-testid="template-settings-custom-head-refusal"]',
  );
  return element.exists() ? element.text() : null;
}

describe("TemplateSettings custom head card", () => {
  it("renders the card with both fields, labelled", () => {
    const wrapper = mountPanel();
    const card = wrapper.find('[data-testid="template-settings-card-head"]');
    expect(card.exists()).toBe(true);
    expect(card.text()).toContain("Custom head");
    expect(field(wrapper, "css").find("label").text()).toBe("CSS");
    expect(field(wrapper, "tags").find("label").text()).toBe("Head tags");
    // The label targets its textarea.
    const label = field(wrapper, "css").find("label");
    expect(label.attributes("for")).toBe(
      textarea(wrapper, "css").attributes("id"),
    );
  });

  it("shows the stored values", () => {
    const wrapper = mountPanel(
      makeSettings({
        customHeadCss: ".a { color: red; }",
        customHeadTags: '<meta name="x">',
      }),
    );
    expect(
      (textarea(wrapper, "css").element as HTMLTextAreaElement).value,
    ).toBe(".a { color: red; }");
    expect(
      (textarea(wrapper, "tags").element as HTMLTextAreaElement).value,
    ).toBe('<meta name="x">');
  });

  it("writes the setting on change, not on every keystroke", async () => {
    const wrapper = mountPanel();
    const css = await type(wrapper, "css", ".footer a { color: #666666; }");
    expect(wrapper.emitted("update")).toBeUndefined();
    await css.trigger("change");
    expect(wrapper.emitted("update")).toEqual([
      [{ customHeadCss: ".footer a { color: #666666; }" }],
    ]);
  });

  it("writes head tags on change", async () => {
    const wrapper = mountPanel();
    const tags = await type(
      wrapper,
      "tags",
      '<meta name="color-scheme" content="light dark">',
    );
    await tags.trigger("change");
    expect(wrapper.emitted("update")).toEqual([
      [{ customHeadTags: '<meta name="color-scheme" content="light dark">' }],
    ]);
  });

  it("unsets a field cleared to whitespace", async () => {
    const wrapper = mountPanel(makeSettings({ customHeadCss: ".a{}" }));
    const css = await type(wrapper, "css", "  \n ");
    await css.trigger("change");
    expect(wrapper.emitted("update")).toEqual([[{ customHeadCss: undefined }]]);
  });

  it("shows the hint, not an error, for accepted content", async () => {
    const wrapper = mountPanel();
    await type(wrapper, "tags", '<meta name="a">');
    expect(refusal(wrapper, "tags")).toBeNull();
    expect(field(wrapper, "tags").text()).toContain(
      "Meta and link tags, styles and Outlook conditional comments",
    );
    expect(textarea(wrapper, "tags").attributes("aria-invalid")).toBe("false");
  });

  it("names a refused element as the author types, before any change", async () => {
    const wrapper = mountPanel();
    await type(wrapper, "tags", "<script>alert(1)</script>");
    expect(refusal(wrapper, "tags")).toBe(
      "<script> isn't allowed here. These tags are left out of the email until it's removed.",
    );
    expect(textarea(wrapper, "tags").attributes("aria-invalid")).toBe("true");
    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("stores refused content as typed so it can be fixed", async () => {
    const wrapper = mountPanel();
    const tags = await type(
      wrapper,
      "tags",
      '<link rel="x" href="https://a.test" onload="x()">',
    );
    await tags.trigger("change");
    expect(wrapper.emitted("update")).toEqual([
      [{ customHeadTags: '<link rel="x" href="https://a.test" onload="x()">' }],
    ]);
    expect(refusal(wrapper, "tags")).toBe(
      "Event handler attributes (onload) aren't allowed. These tags are left out of the email until it's removed.",
    );
  });

  it.each([
    [
      "css",
      ".a{}</style>",
      "CSS can't contain “<”. This CSS is left out of the email until it's fixed.",
    ],
    [
      "tags",
      '<link rel="x" href="javascript:alert(1)">',
      "The href URL uses a scheme that isn't allowed. These tags are left out of the email until it's fixed.",
    ],
    [
      "tags",
      "<!--[if mso]><style>td{}</style>",
      "A comment opened with <!-- is never closed with -->. These tags are left out of the email until it's closed.",
    ],
    [
      "tags",
      '<meta name="a"',
      "A tag is never closed with >. These tags are left out of the email until it's closed.",
    ],
    [
      "tags",
      "<title>Sale",
      "<title> is never closed with </title>. These tags are left out of the email until it's closed.",
    ],
    [
      "tags",
      '<meta http-equiv="refresh" content="0;url=https://x.test">',
      "http-equiv=\"refresh\" isn't allowed; only content-type and x-ua-compatible are. These tags are left out of the email until it's removed.",
    ],
    [
      "tags",
      '<meta a=b"><script>alert(1)</script><!-- " -->',
      "A tag here can be read in more than one way: a < or > inside it, a quote or = in an unquoted value, or attributes without spaces between them. These tags are left out of the email until it's fixed.",
    ],
  ] as const)(
    "explains a refused %s value %s",
    async (name, value, message) => {
      const wrapper = mountPanel();
      await type(wrapper, name, value);
      expect(refusal(wrapper, name)).toBe(message);
    },
  );

  it("explains a stored refused value on mount", () => {
    const wrapper = mountPanel(makeSettings({ customHeadTags: "<mj-text>" }));
    expect(refusal(wrapper, "tags")).toBe(
      "<mj-text> isn't allowed here. These tags are left out of the email until it's removed.",
    );
  });

  it("follows the settings when they change from outside (undo)", async () => {
    const wrapper = mountPanel(makeSettings({ customHeadCss: ".a{}" }));
    await type(wrapper, "css", ".b{}");
    await wrapper.setProps({
      settings: makeSettings({ customHeadCss: ".c{}" }),
    });
    await nextTick();
    expect(
      (textarea(wrapper, "css").element as HTMLTextAreaElement).value,
    ).toBe(".c{}");
  });

  it("keeps only the allowed field, and drops the card with neither", () => {
    const cssOnly = mountPanel(makeSettings(), ["customHeadCss"]);
    expect(field(cssOnly, "css").exists()).toBe(true);
    expect(field(cssOnly, "tags").exists()).toBe(false);

    const neither = mountPanel(
      makeSettings(),
      ALL_TEMPLATE_SETTINGS_FIELDS.filter(
        (f) => f !== "customHeadCss" && f !== "customHeadTags",
      ),
    );
    expect(
      neither.find('[data-testid="template-settings-card-head"]').exists(),
    ).toBe(false);
  });
});
