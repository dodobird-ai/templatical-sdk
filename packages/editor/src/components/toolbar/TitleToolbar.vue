<script setup lang="ts">
import FieldRow from "./FieldRow.vue";
import ColorPicker from "../ColorPicker.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import { useI18n } from "../../composables/useI18n";
import OptionalNumberField from "./OptionalNumberField.vue";
import {
  TITLE_FONT_SIZE_FIELD,
  TITLE_LINE_HEIGHT_FIELD,
  inputClass,
} from "../../constants/styleConstants";
import type { TitleBlock } from "@templatical/types";
import {
  HEADING_LEVEL_FONT_SIZE,
  TITLE_LINE_HEIGHT,
  resolveTitleFontSize,
} from "@templatical/types";
import type { HeadingLevel } from "@templatical/types";
import { AlignCenter, AlignLeft, AlignRight } from "@lucide/vue";
import { fontSelectValue } from "../../utils/withCurrentFont";

defineProps<{
  block: TitleBlock;
  fontFamilies: Array<{ value: string; label: string }>;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<TitleBlock>): void;
}>();

const { t } = useI18n();

const isHeadingLevel = (level: number): level is HeadingLevel =>
  level in HEADING_LEVEL_FONT_SIZE;

function updateField(field: string, value: unknown): void {
  emit("update", { [field]: value } as Partial<TitleBlock>);
}

/**
 * A heading level is a size, so picking one takes the title to that size: a
 * size set by hand on the previous level would make the choice do nothing.
 */
function onLevelChange(event: Event): void {
  if (!(event.target instanceof HTMLSelectElement)) return;
  const level = Number(event.target.value);
  if (!isHeadingLevel(level)) return;
  emit("update", { level, fontSize: undefined });
}
</script>

<template>
  <FieldRow :label="t.title.level" class="tpl:mb-3.5" path="level">
    <select :class="inputClass" :value="block.level" @change="onLevelChange">
      <option :value="1">{{ t.title.heading1 }}</option>
      <option :value="2">{{ t.title.heading2 }}</option>
      <option :value="3">{{ t.title.heading3 }}</option>
      <option :value="4">{{ t.title.heading4 }}</option>
    </select>
  </FieldRow>
  <!--
    Title size and title line height are optional: an empty field leaves them
    to the heading level and TITLE_LINE_HEIGHT. The size field reads the level's
    size as its value, the line height shows its default as the placeholder.
    Emptying the field is how a title goes back to them.
  -->
  <FieldRow :label="t.title.fontSize" class="tpl:mb-3.5" path="fontSize">
    <OptionalNumberField
      v-bind="TITLE_FONT_SIZE_FIELD"
      testid="title-font-size"
      suffix="px"
      :model-value="block.fontSize"
      :placeholder="String(resolveTitleFontSize({ level: block.level }))"
      show-default
      @update:model-value="(fontSize) => emit('update', { fontSize })"
    />
  </FieldRow>
  <FieldRow :label="t.title.lineHeight" class="tpl:mb-3.5" path="lineHeight">
    <OptionalNumberField
      v-bind="TITLE_LINE_HEIGHT_FIELD"
      testid="title-line-height"
      :model-value="block.lineHeight"
      :placeholder="String(TITLE_LINE_HEIGHT)"
      @update:model-value="(lineHeight) => emit('update', { lineHeight })"
    />
  </FieldRow>
  <FieldRow :label="t.title.fontFamily" class="tpl:mb-3.5" path="fontFamily">
    <select
      :class="inputClass"
      :value="fontSelectValue(block.fontFamily)"
      @change="
        updateField(
          'fontFamily',
          ($event.target as HTMLSelectElement).value || undefined,
        )
      "
    >
      <option value="">{{ t.title.inheritFont }}</option>
      <option
        v-for="font in fontFamilies"
        :key="font.value"
        :value="font.value"
      >
        {{ font.label }}
      </option>
    </select>
  </FieldRow>
  <FieldRow :label="t.title.color" class="tpl:mb-3.5" path="color">
    <ColorPicker
      :model-value="block.color ?? ''"
      @update:model-value="updateField('color', $event || undefined)"
    />
  </FieldRow>
  <FieldRow :label="t.title.align" class="tpl:mb-3.5" path="textAlign">
    <SlidingPillSelect
      :options="[
        { value: 'left', label: t.title.alignLeft, icon: AlignLeft },
        { value: 'center', label: t.title.alignCenter, icon: AlignCenter },
        { value: 'right', label: t.title.alignRight, icon: AlignRight },
      ]"
      :model-value="block.textAlign"
      @update:model-value="updateField('textAlign', $event)"
    />
  </FieldRow>
</template>
