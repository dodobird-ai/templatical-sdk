import type { FrameLocator, Locator, Page } from "@playwright/test";
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createTitleBlock,
  type TemplateContent,
} from "@templatical/types";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, darkColorInput } from "../helpers/selectors";

/**
 * A template setting every dark color, with each value distinct so a color
 * landing on the wrong element shows: the template's text and link colors,
 * a section background, a title with its own text color (which must beat the
 * template's), a paragraph without dark colors (which takes the template's,
 * inline mark included), a button with dark colors and one without.
 */
const DARK = {
  body: "rgb(18, 18, 18)",
  templateText: "rgb(232, 232, 232)",
  templateLink: "rgb(138, 180, 248)",
  section: "rgb(30, 30, 30)",
  titleText: "rgb(255, 0, 255)",
  buttonFill: "rgb(255, 204, 0)",
  buttonLabel: "rgb(0, 0, 0)",
} as const;

function darkTemplate(): TemplateContent {
  const content = createDefaultTemplateContent();
  content.settings.linkColor = "#0066cc";
  content.settings.darkColors = {
    backgroundColor: "#121212",
    textColor: "#e8e8e8",
    linkColor: "#8ab4f8",
  };
  content.blocks = [
    createSectionBlock({
      id: "dark-section",
      styles: {
        padding: { top: 8, right: 8, bottom: 8, left: 8 },
        backgroundColor: "#f4f4f4",
      },
      darkColors: { backgroundColor: "#1e1e1e" },
      children: [
        [
          createTitleBlock({
            id: "dark-title",
            content: "<p>Dark title</p>",
            color: "#222222",
            darkColors: { textColor: "#ff00ff" },
          }),
          createParagraphBlock({
            id: "dark-paragraph",
            content:
              '<p>Body <span style="color: #555555">mark</span> <a href="https://example.com">link</a></p>',
          }),
          createButtonBlock({
            id: "dark-button",
            text: "Go",
            url: "https://example.com",
            darkColors: { backgroundColor: "#ffcc00", textColor: "#000000" },
          }),
          createButtonBlock({
            id: "light-button",
            text: "Light",
            url: "https://example.com",
          }),
        ],
      ],
    }),
  ];
  return content;
}

/** The elements of `darkTemplate` whose colors a reader sees. */
interface Surface {
  body: Locator;
  section: Locator;
  title: Locator;
  paragraph: Locator;
  mark: Locator;
  link: Locator;
  button: Locator;
  lightButton: Locator;
}

type Paint = Record<keyof typeof DARK | "lightButtonFill" | "lightButtonLabel", string>;

/** The compiled email in the export preview frame. */
function emailSurface(frame: FrameLocator): Surface {
  return {
    body: frame.locator("body"),
    section: frame.locator(".tpl-dark-section-bg-1e1e1e > table"),
    title: frame.getByText("Dark title", { exact: true }),
    paragraph: frame.locator(".tpl-rich-text p").filter({ hasText: "Body" }),
    mark: frame.getByText("mark", { exact: true }),
    link: frame.getByRole("link", { name: "link", exact: true }),
    button: frame.getByRole("link", { name: "Go", exact: true }),
    lightButton: frame.getByRole("link", { name: "Light", exact: true }),
  };
}

/** The editor canvas. */
function canvasSurface(page: Page): Surface {
  const block = (id: string) => page.locator(`[data-block-id="${id}"]`);
  const paragraph = block("dark-paragraph").locator(SELECTORS.textContent);
  return {
    body: page.locator(SELECTORS.canvasBackground),
    section: block("dark-section").locator(".tpl-block-content").first(),
    title: block("dark-title").locator(SELECTORS.textContent),
    paragraph,
    mark: paragraph.getByText("mark", { exact: true }),
    link: paragraph.getByText("link", { exact: true }),
    button: block("dark-button").locator("a"),
    lightButton: block("light-button").locator("a"),
  };
}

async function paint(surface: Surface): Promise<Paint> {
  const css = (locator: Locator, property: string) =>
    locator.evaluate(
      (el, name) => getComputedStyle(el).getPropertyValue(name),
      property,
    );
  return {
    body: await css(surface.body, "background-color"),
    templateText: await css(surface.paragraph, "color"),
    templateLink: await css(surface.link, "color"),
    section: await css(surface.section, "background-color"),
    titleText: await css(surface.title, "color"),
    buttonFill: await css(surface.button, "background-color"),
    buttonLabel: await css(surface.button, "color"),
    lightButtonFill: await css(surface.lightButton, "background-color"),
    lightButtonLabel: await css(surface.lightButton, "color"),
  };
}

/** What `paint` must read in dark mode, given the light button's own colors. */
function expectedDark(light: Paint): Paint {
  return {
    ...DARK,
    lightButtonFill: light.lightButtonFill,
    lightButtonLabel: light.lightButtonLabel,
  };
}

// Dark colors: an author picks the colors a block (or the template) uses in a
// mail client's dark mode. The canvas dark preview shows them instead of
// inverting, and the exported MJML carries them as dark-mode CSS.
test.describe("Dark mode colors", () => {
  test("inverts the canvas for a template without dark colors", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.toggleDarkMode();
    await expect(page.locator(SELECTORS.canvas)).toHaveAttribute(
      "data-dark-preview",
      "inverted",
    );
    await expect(page.locator(SELECTORS.canvasBackground)).toHaveCSS(
      "filter",
      "invert(1) hue-rotate(180deg)",
    );
  });

  test("previews a title's dark text color instead of inverting", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlockByType("title");
    await page.locator(SELECTORS.darkColorsToggle).click();
    await page.locator(darkColorInput("block", "textColor")).fill("#ff00ff");

    await editorPage.toggleDarkMode();
    await expect(page.locator(SELECTORS.canvas)).toHaveAttribute(
      "data-dark-preview",
      "authored",
    );
    await expect(page.locator(SELECTORS.canvasBackground)).toHaveCSS(
      "filter",
      "none",
    );
    await expect(
      editorPage
        .getBlockByType("title")
        .first()
        .locator(SELECTORS.textContent),
    ).toHaveCSS("color", "rgb(255, 0, 255)");

    // Off again, the title is back to its light color.
    await editorPage.toggleDarkMode();
    await expect(
      editorPage
        .getBlockByType("title")
        .first()
        .locator(SELECTORS.textContent),
    ).not.toHaveCSS("color", "rgb(255, 0, 255)");
  });

  test("previews the template's dark background", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openSettingsTab();
    await page
      .locator(darkColorInput("template", "backgroundColor"))
      .fill("#123456");
    await editorPage.toggleDarkMode();
    await expect(page.locator(SELECTORS.canvasBackground)).toHaveCSS(
      "background-color",
      "rgb(18, 52, 86)",
    );
  });

  test("exports the dark colors as dark-mode CSS", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlockByType("title");
    await page.locator(SELECTORS.darkColorsToggle).click();
    await page.locator(darkColorInput("block", "textColor")).fill("#ff00ff");
    await editorPage.deselectBlock();

    await editorPage.openExport();
    await page.locator(SELECTORS.exportTabMjml).click();
    await expect
      .poll(async () => page.locator(".cm-content").first().textContent())
      .toContain(
        ".tpl-dark-text-ff00ff, .tpl-dark-text-ff00ff * { color: #ff00ff !important; }",
      );
  });

  test("the exported email paints every dark color in a dark-mode client", async ({
    openSharedContent,
    editorPage,
    page,
  }) => {
    await openSharedContent("dark-colors-email", darkTemplate());
    await editorPage.openExport();
    const frame = page.frameLocator(SELECTORS.exportPreviewFrame);
    const email = emailSurface(frame);
    await expect(email.title).toBeVisible();

    await page.emulateMedia({ colorScheme: "light" });
    const light = await paint(email);
    await page.emulateMedia({ colorScheme: "dark" });
    const dark = await paint(email);
    const mark = await email.mark.evaluate((el) => getComputedStyle(el).color);

    expect(dark).toEqual(expectedDark(light));
    // The inline mark takes the template's text color too.
    expect(mark).toBe(DARK.templateText);
    // In light mode none of the dark colors applies.
    expect(
      Object.entries(DARK).filter(([key, value]) =>
        Object.entries(light).some(([at, seen]) => at === key && seen === value),
      ),
    ).toEqual([]);
  });

  test("the canvas previews every dark color with the email's precedence", async ({
    openSharedContent,
    editorPage,
    page,
  }) => {
    await openSharedContent("dark-colors-canvas", darkTemplate());
    const canvas = canvasSurface(page);
    const light = await paint(canvas);
    await editorPage.toggleDarkMode();
    await expect(page.locator(SELECTORS.canvas)).toHaveAttribute(
      "data-dark-preview",
      "authored",
    );
    await expect(canvas.body).toHaveCSS("background-color", DARK.body);
    const dark = await paint(canvas);
    const mark = await canvas.mark.evaluate((el) => getComputedStyle(el).color);

    expect(dark).toEqual(expectedDark(light));
    expect(mark).toBe(DARK.templateText);
  });
});
