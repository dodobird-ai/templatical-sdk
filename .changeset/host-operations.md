---
"@templatical/editor": minor
"@templatical/types": patch
---

`editor.applyOperations(operations)` edits the open template from the host page with a batch of operations, the vocabulary collaboration and the AI chat already use. The batch applies all or nothing and is one undo step: a single Cmd/Ctrl+Z puts back exactly the content from before the call, redo applies it again, and the user's next edit is a step of its own. It marks the editor dirty and reaches `onChange` and autosave like any edit. It returns `{ applied: true }`, or `{ applied: false, code, opIndex, message, blockId? }` naming the refused operation and its `OperationErrorCode`; a refused batch changes nothing and records no undo step. Bare merge tags are converted as `setContent` converts them. With `collaboration`, the batch is sent as the session's own edit. It throws for a slot or wrapper block, while a version is previewed (`SdkError` code `version_preview`, now named in `SdkErrorCode`), and on an unmounted instance. `ApplyOperationsResult` and `OperationErrorCode` are exported from `@templatical/editor`.
