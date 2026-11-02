import { toRaw } from "vue";
import type {
  UseCollaborationReturn,
  UseEditorReturn,
  UseHistoryReturn,
} from "@templatical/core";
import {
  applyOperations,
  applyOperationsInPlace,
  assertNoSlotInContent,
  assertNoWrapperInContent,
  OperationError,
  SdkError,
  type Operation,
  type OperationErrorCode,
  type TemplateContent,
} from "@templatical/types";

/**
 * What `applyOperations()` answers: the whole batch applied as one undo step,
 * or none of it, with the operation that was refused and why.
 */
export type ApplyOperationsResult =
  | { applied: true }
  | {
      applied: false;
      code: OperationErrorCode;
      /** The 0-based index of the refused operation in the batch. */
      opIndex: number;
      message: string;
      /** The block the refusal is about, when there is one. */
      blockId?: string;
    };

export interface UseHostOperationsReturn {
  applyOperations(operations: readonly Operation[]): ApplyOperationsResult;
}

interface UseHostOperationsOptions {
  editor: Pick<
    UseEditorReturn,
    "content" | "state" | "markDirty" | "selectBlock" | "findBlockLocation"
  >;
  history: () => Pick<UseHistoryReturn, "record">;
  collaboration?: {
    core: Pick<UseCollaborationReturn, "applyOperations">;
  } | null;
  /** Merge-tag normalization, as for every other batch arriving from outside. */
  normalize: (
    operations: readonly Operation[],
    content: TemplateContent,
  ) => Operation[];
  /** A version on the canvas is a preview: edits there would be lost on exit. */
  isPreviewingVersion: () => boolean;
}

function refusalOf(error: OperationError): ApplyOperationsResult {
  return {
    applied: false,
    code: error.code,
    opIndex: error.opIndex,
    message: error.message,
    ...(error.blockId === undefined ? {} : { blockId: error.blockId }),
  };
}

/**
 * The same rule `setContent` and `insertBlock` enforce: slots and wrappers are
 * layout, never content. Checked on what the batch brings in, before anything
 * else, so the mistake throws on every path.
 */
export function assertNoLayoutBlocksIn(operations: readonly Operation[]): void {
  for (const op of operations) {
    let blocks: unknown = null;
    // Malformed shapes are left to the engine, which refuses them by index.
    if (op.op === "addBlock" && op.block && typeof op.block === "object")
      blocks = [op.block];
    if (op.op === "setContent") blocks = op.content?.blocks;
    if (!Array.isArray(blocks)) continue;
    // The asserts read only `blocks`.
    const candidate = { blocks } as TemplateContent;
    assertNoSlotInContent(candidate);
    assertNoWrapperInContent(candidate);
  }
}

/**
 * Edits the host application makes to the open template: a batch of
 * operations, applied all or nothing, recorded as one undo step.
 */
export function useHostOperations(
  options: UseHostOperationsOptions,
): UseHostOperationsReturn {
  const { editor } = options;

  function applyLocally(normalized: Operation[]): ApplyOperationsResult {
    try {
      // The check, on a copy: a refusal leaves the canvas and history alone.
      applyOperations(toRaw(editor.content.value), normalized);
    } catch (error) {
      if (error instanceof OperationError) return refusalOf(error);
      throw error;
    }
    options.history().record();
    // The engine copies what it inserts, so the caller's objects never become
    // live editor state.
    applyOperationsInPlace(editor.content.value, normalized);
    editor.markDirty();
    const selected = editor.state.selectedBlockId;
    if (selected && !editor.findBlockLocation(selected)) {
      editor.selectBlock(null);
    }
    return { applied: true };
  }

  return {
    applyOperations(operations) {
      assertNoLayoutBlocksIn(operations);
      if (options.isPreviewingVersion()) {
        throw new SdkError(
          "applyOperations() can't edit the template while a version is previewed.",
          undefined,
          "version_preview",
        );
      }
      if (operations.length === 0) return { applied: true };
      let normalized: Operation[];
      try {
        normalized = options.normalize(operations, toRaw(editor.content.value));
      } catch (error) {
        if (error instanceof OperationError) return refusalOf(error);
        throw error;
      }
      if (!options.collaboration) return applyLocally(normalized);
      // The controller checks locks, sends the batch and owns its undo step.
      const result = options.collaboration.core.applyOperations(normalized, {});
      return result.applied ? { applied: true } : refusalOf(result.error);
    },
  };
}
