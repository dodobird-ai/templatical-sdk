<script setup lang="ts">
import FieldRow from "./FieldRow.vue";
import ColorPicker from "../ColorPicker.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import { useI18n } from "../../composables/useI18n";
import {
  TITLE_FONT_SIZE_FIELD,
  TITLE_LINE_HEIGHT_FIELD,
  inputClass,
  inputGroupInputClass,
  inputSuffixClass,
} from "../../constants/styleConstants";
import type { TitleBlock } from "@templatical/types";
import { TITLE_LINE_HEIGHT, resolveTitleFontSize } from "@templatical/types";
import { AlignCenter, AlignLeft, AlignRight } from "@lucide/vue";
import { fontSelectValue } from "../../utils/withCurrentFont";
import { readOptionalSize } from "../../utils/optionalSizeInput";

defineProps<{
  block: TitleBlock;
  fontFamilies: Array<{ value: string; label: string }>;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<TitleBlock>): void;
}>();

const { t } = useI18n();

function updateField(field: string, value: unknown): void {
  emit("update", { [field]: value } as Partial<TitleBlock>);
}

/**
 * Title size and title line height are optional: an empty field leaves them to
 * the heading level and `TITLE_LINE_HEIGHT`, whose values show as the
 * placeholder. Emptying the field is how a title goes back to them.
 */
function updateOptionalSize(
  event: Event,
  toUpdate: (value: number | undefined) => Partial<TitleBlock>,
): void {
  const el = event.target as HTMLInputElement;
  const entry = readOptionalSize({
    value: el.value,
    badInput: el.validity?.badInput ?? false,
  });
  if (entry.kind === "typing") return;
  emit("update", toUpdate(entry.kind === "size" ? entry.value : undefined));
}
</script>

<template>
  <FieldRow :label="t.title.level" class="tpl:mb-3.5" path="level">
    <select
      :class="inputClass"
      :value="block.level"
      @change="
        updateField('level', Number(($event.target as HTMLSelectElement).value))
      "
    >
      <option :value="1">{{ t.title.heading1 }}</option>
      <option :value="2">{{ t.title.heading2 }}</option>
      <option :value="3">{{ t.title.heading3 }}</option>
      <option :value="4">{{ t.title.heading4 }}</option>
    </select>
  </FieldRow>
  <FieldRow :label="t.title.fontSize" class="tpl:mb-3.5" path="fontSize">
    <div class="tpl:flex tpl:items-stretch">
      <input
        type="number"
        data-testid="title-font-size"
        :class="inputGroupInputClass"
        :value="block.fontSize ?? ''"
        :placeholder="String(resolveTitleFontSize({ level: block.level }))"
        :min="TITLE_FONT_SIZE_FIELD.min"
        :max="TITLE_FONT_SIZE_FIELD.max"
        :step="TITLE_FONT_SIZE_FIELD.step"
        @input="updateOptionalSize($event, (fontSize) => ({ fontSize }))"
      />
      <span :class="inputSuffixClass">px</span>
    </div>
  </FieldRow>
  <FieldRow :label="t.title.lineHeight" class="tpl:mb-3.5" path="lineHeight">
    <input
      type="number"
      data-testid="title-line-height"
      :class="inputClass"
      :value="block.lineHeight ?? ''"
      :placeholder="String(TITLE_LINE_HEIGHT)"
      :min="TITLE_LINE_HEIGHT_FIELD.min"
      :max="TITLE_LINE_HEIGHT_FIELD.max"
      :step="TITLE_LINE_HEIGHT_FIELD.step"
      @input="updateOptionalSize($event, (lineHeight) => ({ lineHeight }))"
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
