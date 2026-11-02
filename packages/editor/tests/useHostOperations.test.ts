// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import {
  useAutoSave,
  useEditor,
  useHistory,
  useHistoryInterceptor,
} from "@templatical/core";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSlotBlock,
  createTitleBlock,
  OperationError,
  type Operation,
  type TemplateContent,
} from "@templatical/types";
import { useHostOperations } from "../src/composables/useHostOperations";

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup());
  vi.useRealTimers();
});

function seed(): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = [
    createTitleBlock({ id: "t1", content: "Hello" }),
    createParagraphBlock({ id: "p1", content: "<p>First</p>" }),
  ];
  return content;
}

function open(
  overrides: {
    normalize?: (ops: readonly Operation[]) => Operation[];
    isPreviewingVersion?: () => boolean;
    collaboration?: Parameters<typeof useHostOperations>[0]["collaboration"];
  } = {},
) {
  const onChange = vi.fn();
  const scope = effectScope();
  const value = scope.run(() => {
    const editor = useEditor({ content: seed() });
    const history = useHistory({
      content: editor.content,
      setContent: editor.setContent,
    });
    useHistoryInterceptor(editor, history);
    const autoSave = useAutoSave({
      content: editor.content,
      isDirty: () => editor.state.isDirty,
      onChange,
      debounce: 100,
    });
    cleanups.push(history.destroy, autoSave.destroy);
    const host = useHostOperations({
      editor,
      history: () => history,
      collaboration: overrides.collaboration ?? null,
      normalize: overrides.normalize ?? ((ops) => [...ops]),
      isPreviewingVersion: overrides.isPreviewingVersion ?? (() => false),
    });
    return { editor, history, host };
  })!;
  cleanups.push(() => scope.stop());
  return { ...value, onChange };
}

const snapshot = (content: TemplateContent) => JSON.stringify(content);

const twoEdits: Operation[] = [
  { op: "updateBlock", blockId: "t1", set: { content: "Welcome" } },
  {
    op: "addBlock",
    block: createParagraphBlock({ id: "p2", content: "<p>Second</p>" }),
    parent: null,
    after: "p1",
  },
];

describe("useHostOperations", () => {
  it("applies the batch and records exactly one undo step", () => {
    const { editor, history, host } = open();
    const before = snapshot(editor.content.value);

    expect(host.applyOperations(twoEdits)).toEqual({ applied: true });

    expect(editor.content.value.blocks.map((b) => b.id)).toEqual([
      "t1",
      "p1",
      "p2",
    ]);
    expect(
      (editor.content.value.blocks[0] as { content: string }).content,
    ).toBe("Welcome");

    history.undo();
    expect(snapshot(editor.content.value)).toBe(before);
    expect(history.canUndo.value).toBe(false);
  });

  it("re-applies the whole batch on redo", () => {
    const { editor, history, host } = open();
    host.applyOperations(twoEdits);
    const after = snapshot(editor.content.value);

    history.undo();
    history.redo();

    expect(snapshot(editor.content.value)).toBe(after);
    expect(history.canRedo.value).toBe(false);
  });

  it("applies nothing when a middle operation is refused, and names it", () => {
    const { editor, history, host } = open();
    const before = snapshot(editor.content.value);

    const result = host.applyOperations([
      twoEdits[0],
      { op: "deleteBlock", blockId: "missing" },
      twoEdits[1],
    ]);

    expect(result).toEqual({
      applied: false,
      code: "block_missing",
      opIndex: 1,
      message: expect.stringContaining("missing"),
      blockId: "missing",
    });
    expect(snapshot(editor.content.value)).toBe(before);
    expect(history.canUndo.value).toBe(false);
    expect(editor.state.isDirty).toBe(false);
  });

  it("marks the editor dirty and fires onChange like a user edit", () => {
    vi.useFakeTimers();
    const { editor, host, onChange } = open();
    expect(editor.state.isDirty).toBe(false);

    host.applyOperations(twoEdits);

    expect(editor.state.isDirty).toBe(true);
    vi.advanceTimersByTime(100);
    expect(onChange).toHaveBeenCalledTimes(1);
    const sent = onChange.mock.calls[0][0] as TemplateContent;
    expect(sent.blocks.map((b) => b.id)).toEqual(["t1", "p1", "p2"]);
  });

  it("keeps a later user edit as its own undo step, even mid-typing", () => {
    const { editor, history, host } = open();
    const original = snapshot(editor.content.value);
    // A keystroke opens a 300 ms coalescing window for p1.
    editor.updateBlock("p1", { content: "<p>Typed</p>" });
    const typed = snapshot(editor.content.value);

    host.applyOperations([twoEdits[0]]);
    const hosted = snapshot(editor.content.value);
    // Within the same window: must not fold into the host's step.
    editor.updateBlock("p1", { content: "<p>Typed more</p>" });

    history.undo();
    expect(snapshot(editor.content.value)).toBe(hosted);
    history.undo();
    expect(snapshot(editor.content.value)).toBe(typed);
    history.undo();
    expect(snapshot(editor.content.value)).toBe(original);
  });

  it("keeps the caller's operations out of live state", () => {
    const { editor, host } = open();
    const block = createParagraphBlock({ id: "p2", content: "<p>Mine</p>" });

    host.applyOperations([
      { op: "addBlock", block, parent: null, after: "p1" },
    ]);
    block.content = "<p>Changed by the caller later</p>";

    expect(
      (editor.content.value.blocks[2] as { content: string }).content,
    ).toBe("<p>Mine</p>");
  });

  it("clears the selection when the batch deletes the selected block", () => {
    const { editor, host } = open();
    editor.selectBlock("p1");

    host.applyOperations([{ op: "deleteBlock", blockId: "p1" }]);

    expect(editor.state.selectedBlockId).toBe(null);
  });

  it("keeps the selection when the selected block survives", () => {
    const { editor, host } = open();
    editor.selectBlock("p1");

    host.applyOperations([twoEdits[0]]);

    expect(editor.state.selectedBlockId).toBe("p1");
  });

  it("treats an empty batch as applied without an undo step or dirtying", () => {
    const { editor, history, host } = open();

    expect(host.applyOperations([])).toEqual({ applied: true });

    expect(history.canUndo.value).toBe(false);
    expect(editor.state.isDirty).toBe(false);
  });

  it("applies the normalized batch, not the raw one", () => {
    const { editor, host } = open({
      normalize: () => [
        { op: "updateBlock", blockId: "t1", set: { content: "Normalized" } },
      ],
    });

    host.applyOperations([twoEdits[0]]);

    expect(
      (editor.content.value.blocks[0] as { content: string }).content,
    ).toBe("Normalized");
  });

  it("returns a refusal the normalizer raises, and changes nothing", () => {
    const { editor, history, host } = open({
      normalize: () => {
        throw new OperationError("invalid_operation", 2, "bad batch");
      },
    });
    const before = snapshot(editor.content.value);

    expect(host.applyOperations(twoEdits)).toEqual({
      applied: false,
      code: "invalid_operation",
      opIndex: 2,
      message: "bad batch",
    });
    expect(snapshot(editor.content.value)).toBe(before);
    expect(history.canUndo.value).toBe(false);
  });

  it("rethrows a normalizer failure that is not a refusal", () => {
    const { host } = open({
      normalize: () => {
        throw new TypeError("boom");
      },
    });

    expect(() => host.applyOperations(twoEdits)).toThrow("boom");
  });

  it("throws on a slot block, as setContent does, before changing anything", () => {
    const { editor, history, host } = open();
    const before = snapshot(editor.content.value);

    expect(() =>
      host.applyOperations([
        twoEdits[0],
        {
          op: "addBlock",
          block: createSlotBlock(),
          parent: null,
          after: null,
        },
      ]),
    ).toThrow(/slot/i);
    expect(snapshot(editor.content.value)).toBe(before);
    expect(history.canUndo.value).toBe(false);
  });

  it("refuses to edit while a version is previewed", () => {
    const { editor, host } = open({ isPreviewingVersion: () => true });
    const before = snapshot(editor.content.value);

    expect(() => host.applyOperations(twoEdits)).toThrow(
      expect.objectContaining({ code: "version_preview" }),
    );
    expect(snapshot(editor.content.value)).toBe(before);
  });

  it("hands the batch to collaboration as the session's own edit", () => {
    const applyOperations = vi.fn(() => ({
      applied: true as const,
      inverse: [] as Operation[],
    }));
    const { editor, history, host } = open({
      collaboration: { core: { applyOperations } },
    });
    const before = snapshot(editor.content.value);

    expect(host.applyOperations(twoEdits)).toEqual({ applied: true });

    expect(applyOperations).toHaveBeenCalledWith(twoEdits, {});
    // The controller owns content and undo; the local stack is untouched.
    expect(snapshot(editor.content.value)).toBe(before);
    expect(history.canUndo.value).toBe(false);
  });

  it("maps a collaboration refusal to the same result shape", () => {
    const { host } = open({
      collaboration: {
        core: {
          applyOperations: () => ({
            applied: false as const,
            error: new OperationError("lock_held", 0, "held", "t1"),
          }),
        },
      },
    });

    expect(host.applyOperations(twoEdits)).toEqual({
      applied: false,
      code: "lock_held",
      opIndex: 0,
      message: "held",
      blockId: "t1",
    });
  });
});
