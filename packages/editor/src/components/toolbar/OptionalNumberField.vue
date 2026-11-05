<script setup lang="ts">
import { computed, ref } from "vue";
import {
  inputClass,
  inputGroupInputClass,
  inputSuffixClass,
} from "../../constants/styleConstants";
import {
  readOptionalSize,
  type SizeGrain,
} from "../../utils/optionalSizeInput";

/**
 * A number field for a value a block may leave to a default. An empty field
 * means "use the default", which `placeholder` shows; emptying the field is
 * how the block goes back to it. Unlike `NumberWithSuffix`, whose value is
 * always set, this one emits `undefined` for an emptied field.
 *
 * With `showDefault` the default is the field's value rather than a grey hint,
 * so the field always reads the size in effect. Emptying it then takes effect
 * when the user leaves the field: going back to the default on the keystroke
 * would write the default into the input while they are replacing the number.
 */
const props = defineProps<{
  modelValue: number | undefined;
  /** The value in effect while the block sets none. */
  placeholder: string;
  /** Show `placeholder` as the value while the block sets none. */
  showDefault?: boolean;
  min: number;
  max: number;
  step: number;
  grain: SizeGrain;
  suffix?: string;
  /**
   * `data-testid` for the `<input>`. A plain attribute on this component falls
   * through to the wrapping element, which is not the one a test reads.
   */
  testid?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: number | undefined): void;
}>();

const input = ref<HTMLInputElement | null>(null);

/** What the field reads while the user is not typing in it. */
const shown = computed(
  () => props.modelValue ?? (props.showDefault ? props.placeholder : ""),
);

function onInput(): void {
  const el = input.value;
  if (!el) return;
  const entry = readOptionalSize(
    { value: el.value, badInput: el.validity?.badInput ?? false },
    props.grain,
  );
  if (entry.kind === "typing") return;
  if (entry.kind === "clear" && props.showDefault) return;
  emit("update:modelValue", entry.kind === "size" ? entry.value : undefined);
}

/**
 * When the user leaves the field, show what is stored. An entry still read as
 * `typing` (`0`, `-3`, `31.5` in a whole-px field) changed nothing, so the
 * field would otherwise go on showing a value the block does not have.
 */
function onChange(): void {
  const el = input.value;
  if (!el) return;
  if (props.showDefault && el.value.trim() === "" && !el.validity?.badInput) {
    emit("update:modelValue", undefined);
    el.value = props.placeholder;
    return;
  }
  el.value = String(shown.value);
}
</script>

<template>
  <div v-if="suffix" class="tpl:flex tpl:items-stretch">
    <input
      ref="input"
      type="number"
      :data-testid="testid"
      :class="inputGroupInputClass"
      :value="shown"
      :placeholder="showDefault ? undefined : placeholder"
      :min="min"
      :max="max"
      :step="step"
      @input="onInput"
      @change="onChange"
    />
    <span :class="inputSuffixClass">{{ suffix }}</span>
  </div>
  <input
    v-else
    ref="input"
    type="number"
    :data-testid="testid"
    :class="inputClass"
    :value="shown"
    :placeholder="showDefault ? undefined : placeholder"
    :min="min"
    :max="max"
    :step="step"
    @input="onInput"
    @change="onChange"
  />
</template>
