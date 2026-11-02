// @vitest-environment happy-dom
//
// `editor.applyOperations()` through the public instance `init()` returns:
// the wiring from `index.ts` through `Editor.vue`'s `defineExpose` to the
// host-operations composable, the keyboard undo and redo a user presses, and
// the merge-tag normalization every content-in path gets. The composable's
// own contract (atomicity, one step, onChange) is pinned in
// `useHostOperations.test.ts`.

import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createTitleBlock,
  type TemplateContent,
} from "@templatical/types";
import {
  init,
  type TemplaticalEditor,
  type TemplaticalEditorConfig,
} from "../src/index";

const handles: TemplaticalEditor[] = [];
afterEach(() => {
  for (const handle of handles.splice(0)) handle.unmount();
  document.body.innerHTML = "";
});

function content(): TemplateContent {
  const result = createDefaultTemplateContent();
  result.blocks = [
    createTitleBlock({ id: "t1", content: "Hello" }),
    createParagraphBlock({ id: "p1", content: "<p>First</p>" }),
  ];
  return result;
}

async function open(config: Partial<TemplaticalEditorConfig> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const handle = await init({
    container,
    shadowDom: false,
    content: content(),
    ...config,
  });
  handles.push(handle);
  await nextTick();
  return handle;
}

function press(shiftKey: boolean): void {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
      shiftKey,
      bubbles: true,
    }),
  );
}

describe("editor.applyOperations", () => {
  it("is one Ctrl+Z away from the content before the call, and Ctrl+Shift+Z brings it back", async () => {
    const editor = await open();
    const before = JSON.stringify(editor.getContent());

    const result = editor.applyOperations([
      { op: "updateBlock", blockId: "t1", set: { content: "Welcome" } },
      { op: "deleteBlock", blockId: "p1" },
    ]);

    expect(result).toEqual({ applied: true });
    expect(editor.getContent().blocks.map((b) => b.id)).toEqual(["t1"]);
    const after = JSON.stringify(editor.getContent());

    press(false);
    expect(JSON.stringify(editor.getContent())).toBe(before);

    press(true);
    expect(JSON.stringify(editor.getContent())).toBe(after);
  });

  it("marks the editor dirty and reports it through onDirtyChange", async () => {
    const onDirtyChange = vi.fn();
    const editor = await open({ onDirtyChange });
    expect(editor.isDirty()).toBe(false);

    editor.applyOperations([
      { op: "updateSettings", set: { backgroundColor: "#000000" } },
    ]);
    await nextTick();

    expect(editor.isDirty()).toBe(true);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("refuses the whole batch and leaves undo with nothing to do", async () => {
    const editor = await open();
    const before = JSON.stringify(editor.getContent());

    const result = editor.applyOperations([
      { op: "updateBlock", blockId: "t1", set: { content: "Welcome" } },
      {
        op: "addBlock",
        block: createParagraphBlock({ id: "p1" }),
        parent: null,
        after: null,
      },
    ]);

    expect(result).toMatchObject({
      applied: false,
      code: "block_exists",
      opIndex: 1,
      blockId: "p1",
    });
    expect(JSON.stringify(editor.getContent())).toBe(before);
    press(false);
    expect(JSON.stringify(editor.getContent())).toBe(before);
    expect(editor.isDirty()).toBe(false);
  });

  it("turns bare merge tags into tags, as setContent does", async () => {
    const editor = await open({
      mergeTags: { tags: [{ label: "First name", value: "{{first_name}}" }] },
    });

    editor.applyOperations([
      {
        op: "updateBlock",
        blockId: "p1",
        set: { content: "<p>Hi {{first_name}}</p>" },
      },
    ]);

    const paragraph = editor
      .getContent()
      .blocks.find((b) => b.id === "p1") as { content: string };
    expect(paragraph.content).toContain('data-merge-tag="{{first_name}}"');
  });

  it("throws on a handle whose editor was unmounted", async () => {
    const editor = await open();
    editor.unmount();

    expect(() =>
      editor.applyOperations([{ op: "deleteBlock", blockId: "p1" }]),
    ).toThrow("[Templatical] Editor not ready");
  });
});
