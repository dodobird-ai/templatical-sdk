// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { useEditor } from "@templatical/core";
import {
  createBackgroundImage,
  createButtonBlock,
  createDefaultTemplateContent,
  createImageBlock,
  createParagraphBlock,
  createSectionBlock,
  createTitleBlock,
  type Block,
  type TemplateContent,
  type TemplateSettings,
} from "@templatical/types";
import Canvas from "../src/components/Canvas.vue";
import ColorPicker from "../src/components/ColorPicker.vue";
import TemplateSettingsPanel from "../src/components/TemplateSettings.vue";
import Toolbar from "../src/components/Toolbar.vue";
import en from "../src/i18n/locales/en";
import { EDITOR_KEY, FONTS_MANAGER_KEY, TRANSLATIONS_KEY } from "../src/keys";
import {
  darkColorHostClasses,
  documentDarkColorClasses,
  getBlockWrapperStyle,
  getDocumentStyle,
} from "../src/utils/blockComponentResolver";
import {
  DARK_COLOR_FIELDS,
  darkColorFieldsFor,
  withDarkColor,
} from "../src/utils/darkColors";
import { resolveDarkPreview } from "../src/utils/darkPreview";
import { mountEditor } from "./helpers/mount";

const resolveFontFamily = (font: string) => font;

describe("withDarkColor", () => {
  it("sets a color on an absent object", () => {
    expect(withDarkColor(undefined, "textColor", "#eeeeee")).toEqual({
      textColor: "#eeeeee",
    });
  });

  it("keeps the other fields", () => {
    expect(
      withDarkColor({ backgroundColor: "#111111" }, "textColor", "#eeeeee"),
    ).toEqual({ backgroundColor: "#111111", textColor: "#eeeeee" });
  });

  it("drops a cleared field and keeps the rest", () => {
    expect(
      withDarkColor(
        { backgroundColor: "#111111", textColor: "#eeeeee" },
        "textColor",
        "",
      ),
    ).toEqual({ backgroundColor: "#111111" });
  });

  it("is undefined once the last color is cleared", () => {
    expect(withDarkColor({ textColor: "#eeeeee" }, "textColor", "")).toBe(
      undefined,
    );
  });

  it("does not mutate its input", () => {
    const colors = { textColor: "#eeeeee" };
    withDarkColor(colors, "backgroundColor", "#111111");
    expect(colors).toEqual({ textColor: "#eeeeee" });
  });
});

describe("darkColorFieldsFor", () => {
  it.each([
    ["section", createSectionBlock(), ["backgroundColor"]],
    ["title", createTitleBlock(), ["textColor", "backgroundColor"]],
    ["paragraph", createParagraphBlock(), ["textColor", "backgroundColor"]],
    ["button", createButtonBlock(), ["backgroundColor", "textColor"]],
  ] as const)("offers a %s its fields", (_type, block, fields) => {
    expect(darkColorFieldsFor(block)).toEqual(fields);
  });

  it("offers nothing to a block type without dark colors", () => {
    expect(darkColorFieldsFor(createImageBlock())).toBe(null);
  });

  it("covers exactly the block types that carry darkColors", () => {
    expect(Object.keys(DARK_COLOR_FIELDS).sort()).toEqual([
      "button",
      "paragraph",
      "section",
      "title",
    ]);
  });
});

describe("canvas dark color variables", () => {
  it("adds nothing for a block without dark colors", () => {
    const style = getBlockWrapperStyle(createTitleBlock());
    expect(
      Object.keys(style).filter((key) => key.startsWith("--tpl-dark")),
    ).toEqual([]);
    expect(darkColorHostClasses(style)).toEqual([]);
  });

  it("carries a text block's colors and their classes", () => {
    const style = getBlockWrapperStyle(
      createParagraphBlock({
        darkColors: { backgroundColor: "#2a2a2a", textColor: "#ffffff" },
      }),
    );
    expect([style["--tpl-dark-bg"], style["--tpl-dark-text"]]).toEqual([
      "#2a2a2a",
      "#ffffff",
    ]);
    expect(darkColorHostClasses(style)).toEqual([
      "tpl-has-dark-bg",
      "tpl-has-dark-text",
    ]);
  });

  it("carries a button's fill and label under their own names", () => {
    const style = getBlockWrapperStyle(
      createButtonBlock({
        darkColors: { backgroundColor: "#8ab4f8", textColor: "#000000" },
      }),
    );
    expect(darkColorHostClasses(style)).toEqual([
      "tpl-has-dark-button-bg",
      "tpl-has-dark-button-text",
    ]);
    expect(style["--tpl-dark-button-bg"]).toBe("#8ab4f8");
  });

  it("skips a cleared color", () => {
    const style = getBlockWrapperStyle(
      createTitleBlock({ darkColors: { textColor: " " } }),
    );
    expect(darkColorHostClasses(style)).toEqual([]);
  });

  it("gives a hero section none, as the renderer does", () => {
    const style = getBlockWrapperStyle(
      createSectionBlock({
        backgroundImage: {
          ...createBackgroundImage("https://example.com/hero.jpg"),
          naturalWidth: 1200,
          naturalHeight: 600,
        },
        hero: { height: "image", verticalAlign: "middle" },
        darkColors: { backgroundColor: "#000000" },
      }),
    );
    expect(darkColorHostClasses(style)).toEqual([]);
  });

  it("carries the template's text and link colors on the document style", () => {
    const settings: TemplateSettings = {
      ...createDefaultTemplateContent().settings,
      darkColors: { textColor: "#e8e8e8", linkColor: "#8ab4f8" },
    };
    const style = getDocumentStyle(settings, resolveFontFamily);
    expect([style["--tpl-doc-dark-text"], style["--tpl-doc-dark-link"]]).toEqual(
      ["#e8e8e8", "#8ab4f8"],
    );
    expect(documentDarkColorClasses(settings)).toEqual([
      "tpl-canvas--dark-text",
      "tpl-canvas--dark-link",
    ]);
  });

  it("adds no document class for a background-only template", () => {
    const settings: TemplateSettings = {
      ...createDefaultTemplateContent().settings,
      darkColors: { backgroundColor: "#121212" },
    };
    expect(documentDarkColorClasses(settings)).toEqual([]);
  });
});

describe("resolveDarkPreview", () => {
  const plain = createDefaultTemplateContent();
  const authored: TemplateContent = {
    ...createDefaultTemplateContent(),
    blocks: [createTitleBlock({ darkColors: { textColor: "#ffffff" } })],
  };

  it("is off when the preview is off, dark colors or not", () => {
    expect([
      resolveDarkPreview(false, plain),
      resolveDarkPreview(false, authored),
    ]).toEqual(["off", "off"]);
  });

  it("inverts a template without dark colors", () => {
    expect(resolveDarkPreview(true, plain)).toBe("inverted");
  });

  it("shows the authored colors of a template that has some", () => {
    expect(resolveDarkPreview(true, authored)).toBe("authored");
  });
});

describe("Canvas dark preview", () => {
  function mountCanvas(content: TemplateContent, darkMode: boolean) {
    return mountEditor(Canvas, {
      props: {
        viewport: "desktop",
        content,
        selectedBlockId: null,
        darkMode,
        previewMode: false,
      },
      provides: {
        [EDITOR_KEY]: useEditor({ content }),
        [TRANSLATIONS_KEY]: en,
      },
    });
  }

  function withBlocks(blocks: Block[]): TemplateContent {
    return { ...createDefaultTemplateContent(), blocks };
  }

  it("inverts the canvas when the template has no dark colors", () => {
    const wrapper = mountCanvas(withBlocks([createTitleBlock()]), true);
    const canvas = wrapper.get(".tpl-canvas");
    expect(canvas.attributes("data-dark-preview")).toBe("inverted");
    expect(canvas.classes()).toContain("tpl-canvas--dark-mode");
    expect(
      (wrapper.get('[data-testid="canvas-background"]').element as HTMLElement)
        .style.filter,
    ).toBe("invert(1) hue-rotate(180deg)");
  });

  it("paints the authored colors, without inverting, when it has some", () => {
    const content = withBlocks([
      createParagraphBlock({
        content: "<p>Body</p>",
        darkColors: { textColor: "#ffffff" },
      }),
    ]);
    content.settings.darkColors = {
      backgroundColor: "#121212",
      linkColor: "#8ab4f8",
    };
    const wrapper = mountCanvas(content, true);
    const canvas = wrapper.get(".tpl-canvas");
    expect(canvas.attributes("data-dark-preview")).toBe("authored");
    expect(
      ["tpl-canvas--dark-mode", "tpl-canvas--dark-authored", "tpl-canvas--dark-link"].map(
        (name) => canvas.classes().includes(name),
      ),
    ).toEqual([false, true, true]);
    const background = wrapper.get('[data-testid="canvas-background"]')
      .element as HTMLElement;
    expect(background.style.filter).toBe("");
    expect(
      ["#121212", "rgb(18, 18, 18)"].includes(background.style.backgroundColor),
    ).toBe(true);
    expect(
      wrapper.get('[data-block-type="paragraph"] .tpl-block-content').classes(),
    ).toContain("tpl-has-dark-text");
  });

  it("keeps the light background when the preview is off", () => {
    const content = withBlocks([]);
    content.settings.darkColors = { backgroundColor: "#121212" };
    const wrapper = mountCanvas(content, false);
    expect(wrapper.get(".tpl-canvas").attributes("data-dark-preview")).toBe(
      "off",
    );
    expect(
      ["#ffffff", "rgb(255, 255, 255)"].includes(
        (wrapper.get('[data-testid="canvas-background"]').element as HTMLElement)
          .style.backgroundColor,
      ),
    ).toBe(true);
  });
});

describe("Toolbar dark colors group", () => {
  function mountToolbar(block: Block) {
    return mountEditor(Toolbar, {
      props: { block },
      provides: { [TRANSLATIONS_KEY]: en },
      global: {
        stubs: {
          TitleToolbar: true,
          ParagraphToolbar: true,
          ImageToolbar: true,
          ButtonToolbar: true,
          SectionToolbar: true,
          CommonBlockSettings: true,
        },
      },
    });
  }

  it("is closed for a block without dark colors and opens on toggle", async () => {
    const wrapper = mountToolbar(createTitleBlock());
    const control = wrapper.get('[data-testid="block-dark-colors"]');
    expect((control.element.parentElement as HTMLElement).style.display).toBe(
      "none",
    );
    await wrapper.get('[data-testid="dark-colors-toggle"]').trigger("click");
    expect((control.element.parentElement as HTMLElement).style.display).toBe(
      "",
    );
  });

  it("is open for a block that already sets a dark color", () => {
    const wrapper = mountToolbar(
      createTitleBlock({ darkColors: { textColor: "#ffffff" } }),
    );
    const control = wrapper.get('[data-testid="block-dark-colors"]');
    expect((control.element.parentElement as HTMLElement).style.display).toBe(
      "",
    );
  });

  it("is absent for a block type without dark colors", () => {
    const wrapper = mountToolbar(createImageBlock());
    expect(wrapper.find('[data-testid="block-dark-colors"]').exists()).toBe(
      false,
    );
  });

  it("emits the block's new dark colors", async () => {
    const wrapper = mountToolbar(
      createParagraphBlock({ darkColors: { backgroundColor: "#2a2a2a" } }),
    );
    const picker = wrapper
      .get('[data-testid="block-dark-colors-textColor"]')
      .findComponent(ColorPicker);
    await picker.vm.$emit("update:modelValue", "#ffffff");
    expect(wrapper.emitted("update")).toEqual([
      [{ darkColors: { backgroundColor: "#2a2a2a", textColor: "#ffffff" } }],
    ]);
  });

  it("labels a button's background as its button color", () => {
    const wrapper = mountToolbar(createButtonBlock());
    expect(
      wrapper.get('[data-testid="block-dark-colors-backgroundColor"]').text(),
    ).toContain(en.darkColors.buttonColor);
  });
});

describe("TemplateSettings dark colors", () => {
  const fontsManager = {
    fonts: ref([{ label: "Default", value: "Arial" }]),
    defaultFont: ref("Arial"),
    loadCustomFonts: async () => {},
    cleanupFontLinks: () => {},
    setCustomFontsEnabled: () => {},
  };

  function mountSettings(settings: TemplateSettings) {
    return mountEditor(TemplateSettingsPanel, {
      props: { settings },
      provides: { [FONTS_MANAGER_KEY]: fontsManager },
    });
  }

  it("offers the background, text and link colors", () => {
    const wrapper = mountSettings(createDefaultTemplateContent().settings);
    expect(
      ["backgroundColor", "textColor", "linkColor"].map((field) =>
        wrapper
          .find(`[data-testid="template-dark-colors-${field}"]`)
          .exists(),
      ),
    ).toEqual([true, true, true]);
  });

  it("emits the template's new dark colors", async () => {
    const wrapper = mountSettings({
      ...createDefaultTemplateContent().settings,
      darkColors: { textColor: "#e8e8e8" },
    });
    await wrapper
      .get('[data-testid="template-dark-colors-backgroundColor"]')
      .findComponent(ColorPicker)
      .vm.$emit("update:modelValue", "#121212");
    expect(wrapper.emitted("update")).toEqual([
      [{ darkColors: { textColor: "#e8e8e8", backgroundColor: "#121212" } }],
    ]);
  });

  it("emits undefined when the last dark color is cleared", async () => {
    const wrapper = mountSettings({
      ...createDefaultTemplateContent().settings,
      darkColors: { textColor: "#e8e8e8" },
    });
    await wrapper
      .get('[data-testid="template-dark-colors-textColor"]')
      .findComponent(ColorPicker)
      .vm.$emit("update:modelValue", "");
    expect(wrapper.emitted("update")).toEqual([[{ darkColors: undefined }]]);
  });
});
