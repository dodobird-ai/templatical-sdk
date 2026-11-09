// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { h } from "vue";
import { createSectionBlock } from "@templatical/types";
import BlockWrapper from "../src/components/blocks/BlockWrapper.vue";
import { mountEditor } from "./helpers/mount";

/**
 * A section's dark colours on the canvas reach the block content through the
 * `tpl-has-dark-*` host classes. A full-width band renders its content in a
 * separate branch (inside `.tpl-band-frame`), which must carry them too —
 * the merge of upstream's band once dropped them there.
 */
function mountSection(fullWidth: boolean) {
  const block = createSectionBlock({
    children: [[]],
    wrapper: { backgroundColor: "#eeeeee", fullWidth },
    // A section carries a dark background only (its text is its blocks').
    darkColors: { backgroundColor: "#101010" },
  });
  return mountEditor(BlockWrapper, {
    props: {
      block,
      isSelected: false,
      viewport: "desktop",
      previewMode: false,
    },
    slots: { default: () => h("div", { class: "tpl-test-child" }, "child") },
  });
}

describe("dark colours on a section's canvas content", () => {
  it("carry their host classes inside a full-width band", () => {
    const content = mountSection(true).find(
      ".tpl-band-frame .tpl-block-content",
    );
    expect(content.exists()).toBe(true);
    expect(content.classes()).toContain("tpl-has-dark-bg");
  });

  it("carry them in an email-width section too (control)", () => {
    const wrapper = mountSection(false);
    expect(wrapper.find(".tpl-band-frame").exists()).toBe(false);
    expect(wrapper.find(".tpl-block-content").classes()).toContain(
      "tpl-has-dark-bg",
    );
  });
});
