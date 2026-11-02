import type { Page } from "@playwright/test";
import type {
  Operation,
  TemplateContent,
  TitleBlock,
} from "@templatical/types";
import { test, expect } from "../fixtures/editor.fixture";

/**
 * `editor.applyOperations()` driven from the host page, as an assistant next
 * to the editor would: the batch lands on the canvas, Cmd/Ctrl+Z takes the
 * whole batch back in one press, redo re-applies it, and a refused batch
 * changes nothing.
 *
 * Reads and writes through `window.__tplPlaygroundApplyOperations` and
 * `window.__tplPlaygroundGetContent` (`apps/playground/src/host/useSceneInit.ts`),
 * test hooks rather than visible UI, like the other `__tplPlayground*` hooks.
 */

type Hooks = {
  __tplPlaygroundApplyOperations: (operations: Operation[]) => unknown;
  __tplPlaygroundGetContent: () => TemplateContent;
};

async function hooksReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof (window as unknown as Partial<Hooks>)
        .__tplPlaygroundApplyOperations === "function",
  );
}

function apply(page: Page, operations: Operation[]): Promise<unknown> {
  return page.evaluate(
    (ops) => (window as unknown as Hooks).__tplPlaygroundApplyOperations(ops),
    operations,
  );
}

function content(page: Page): Promise<string> {
  return page.evaluate(() =>
    JSON.stringify((window as unknown as Hooks).__tplPlaygroundGetContent()),
  );
}

const title: TitleBlock = {
  id: "host-title",
  type: "title",
  content: "Added by the host",
  level: 2,
  textAlign: "center",
  styles: { padding: { top: 10, right: 10, bottom: 10, left: 10 } },
};

const hostTitle = (after: string | null): Operation => ({
  op: "addBlock",
  block: title,
  parent: null,
  after,
});

test.describe("host operations", () => {
  test("a batch is one undo step, and redo re-applies it", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await hooksReady(page);
    const before = await content(page);
    const ids = await editorPage.getBlockIds();

    const result = await apply(page, [
      hostTitle(null),
      { op: "deleteBlock", blockId: ids[ids.length - 1] },
    ]);

    expect(result).toEqual({ applied: true });
    const added = page.locator('[data-block-id="host-title"]');
    await expect(added).toContainText("Added by the host");
    await expect
      .poll(() => editorPage.getBlockIds())
      .toEqual(["host-title", ...ids.slice(0, -1)]);
    const after = await content(page);

    await page.keyboard.press("Meta+z");
    await expect(added).toHaveCount(0);
    await expect.poll(() => editorPage.getBlockIds()).toEqual(ids);
    expect(await content(page)).toBe(before);

    await page.keyboard.press("Meta+Shift+z");
    await expect(added).toContainText("Added by the host");
    expect(await content(page)).toBe(after);
  });

  test("a refused batch changes nothing and names the operation", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await hooksReady(page);
    const before = await content(page);
    const ids = await editorPage.getBlockIds();

    const result = await apply(page, [
      hostTitle(null),
      { op: "deleteBlock", blockId: "no-such-block" },
    ]);

    expect(result).toMatchObject({
      applied: false,
      code: "block_missing",
      opIndex: 1,
    });
    await expect(page.locator('[data-block-id="host-title"]')).toHaveCount(0);
    expect(await editorPage.getBlockIds()).toEqual(ids);
    expect(await content(page)).toBe(before);
  });

  test("the user's next edit is an undo step of its own", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await hooksReady(page);
    const ids = await editorPage.getBlockIds();

    await apply(page, [hostTitle(ids[0])]);
    const added = page.locator('[data-block-id="host-title"]');
    await expect(added).toHaveCount(1);

    // The user deletes the first block from the canvas.
    await editorPage.selectBlock(0);
    await editorPage.deleteSelectedBlock();
    await expect
      .poll(() => editorPage.getBlockIds())
      .toEqual(["host-title", ...ids.slice(1)]);

    await page.keyboard.press("Escape");
    await page.keyboard.press("Meta+z");
    await expect
      .poll(() => editorPage.getBlockIds())
      .toEqual([ids[0], "host-title", ...ids.slice(1)]);

    await page.keyboard.press("Meta+z");
    await expect.poll(() => editorPage.getBlockIds()).toEqual(ids);
  });
});
