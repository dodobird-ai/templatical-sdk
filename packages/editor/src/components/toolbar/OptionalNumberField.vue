<script setup lang="ts">
import { ref } from "vue";
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
 */
const props = defineProps<{
  modelValue: number | undefined;
  /** The value in effect while the block sets none. */
  placeholder: string;
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

function onInput(): void {
  const el = input.value;
  if (!el) return;
  const entry = readOptionalSize(
    { value: el.value, badInput: el.validity?.badInput ?? false },
    props.grain,
  );
  if (entry.kind === "typing") return;
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
  el.value = props.modelValue === undefined ? "" : String(props.modelValue);
}
</script>

<template>
  <div v-if="suffix" class="tpl:flex tpl:items-stretch">
    <input
      ref="input"
      type="number"
      :data-testid="testid"
      :class="inputGroupInputClass"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
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
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :min="min"
    :max="max"
    :step="step"
    @input="onInput"
    @change="onChange"
  />
</template>
