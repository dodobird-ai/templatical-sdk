import {
  isMenu,
  isTable,
  isTitle,
  resolveTitleFontSize,
} from "@templatical/types";
import type { Block } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "a11y.text-too-small",
  reference:
    "https://docs.templatical.com/quality/accessibility/rule-catalog#text",
  severity: "warning",
};

function getFontSize(block: Block): number | null {
  if (isMenu(block) || isTable(block)) return block.fontSize;
  // A title's level sizes are all large; only a title size of its own can be
  // small, but the check reads the size in effect either way.
  if (isTitle(block)) return resolveTitleFontSize(block);
  return null;
}

export const textTooSmall: Rule = {
  meta,
  block(block, _ctx, opts) {
    const fontSize = getFontSize(block);
    if (fontSize === null) return null;
    if (fontSize >= opts.thresholds.minFontSize) return null;
    return {
      blockId: block.id,
      params: { size: fontSize, min: opts.thresholds.minFontSize },
    };
  },
};
