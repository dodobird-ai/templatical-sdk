<script setup lang="ts" generic="F extends DarkColorField">
import FieldRow from "./FieldRow.vue";
import ColorPicker from "../ColorPicker.vue";
import { useI18n } from "../../composables/useI18n";
import type { DarkColorField } from "@templatical/types";
import { withDarkColor } from "../../utils/darkColors";

/**
 * The colors a block or the template uses when the reader's mail client is in
 * dark mode, one color picker per field. Clearing every picker emits
 * `undefined`, so nothing is stored. Generic over the fields shown, so what it
 * emits holds only those fields: a section's control cannot emit a link color.
 */
const props = defineProps<{
  colors: Partial<Record<F, string>> | undefined;
  fields: readonly F[];
  /** Labels replacing the default ones, e.g. a button's fill. */
  labels?: Partial<Record<F, string>>;
  /** Prefix of the `data-testid` on the control and on each field. */
  testId: string;
  /** Localization path of the stored object, for the field override badge. */
  path: string;
  /** Whether `path` is a template setting rather than a block field. */
  settings?: boolean;
}>();

const emit = defineEmits<{
  (e: "update", colors: Partial<Record<F, string>> | undefined): void;
}>();

const { t } = useI18n();

/** Where a new pick starts: a plausible dark-mode value for the field. */
const SEED_COLORS: Record<DarkColorField, string> = {
  backgroundColor: "#121212",
  textColor: "#e8e8e8",
  linkColor: "#8ab4f8",
};

function label(field: F): string {
  return props.labels?.[field] ?? t.darkColors[field];
}

function update(field: F, value: string): void {
  emit("update", withDarkColor(props.colors, field, value));
}
</script>

<template>
  <div
    class="tpl:flex tpl:flex-col"
    :class="settings ? 'tpl:gap-3.5' : undefined"
    :data-testid="testId"
  >
    <p
      class="tpl:m-0 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
      :class="settings ? undefined : 'tpl:mb-3.5'"
    >
      {{ t.darkColors.hint }}
    </p>
    <div
      v-for="field in fields"
      :key="field"
      :data-testid="`${testId}-${field}`"
    >
      <FieldRow
        :label="label(field)"
        :path="`${path}.${field}`"
        :settings="settings"
      >
        <ColorPicker
          :model-value="colors?.[field] ?? ''"
          :seed-color="SEED_COLORS[field]"
          :aria-label="`${t.darkColors.title}: ${label(field)}`"
          @update:model-value="update(field, $event)"
        />
      </FieldRow>
    </div>
  </div>
</template>
