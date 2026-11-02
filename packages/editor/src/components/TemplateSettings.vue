<script setup lang="ts">
import FieldRow from "./toolbar/FieldRow.vue";
import ColorPicker from "./ColorPicker.vue";
import MergeTagTextarea from "./MergeTagTextarea.vue";
import ToggleSwitch from "./ToggleSwitch.vue";
import { useI18n } from "../composables/useI18n";
import {
  checkCustomHeadCss,
  checkCustomHeadTags,
  resolveContentDirection,
  type CustomHeadCheck,
  type TemplateSettings,
} from "@templatical/types";
import {
  cardClass,
  inputClass,
  inputGroupInputClass,
  inputSuffixClass,
  labelClass,
  monoTextareaClass,
  DEFAULT_BG_COLOR,
} from "../constants/styleConstants";
import { Circle, Code, Eye, Globe, Info, Square } from "@lucide/vue";
import { computed, inject, ref, watch } from "vue";
import { fontSelectValue, withCurrentFont } from "../utils/withCurrentFont";
import {
  FONTS_MANAGER_KEY,
  TEMPLATE_SETTINGS_FIELDS_KEY,
  requireInject,
} from "../keys";
import {
  ALL_TEMPLATE_SETTINGS_FIELDS,
  TEMPLATE_SETTINGS_FIELD_CARDS,
  type TemplateSettingsCard,
  type TemplateSettingsField,
} from "../utils/templateSettingsFields";

const props = defineProps<{
  settings: TemplateSettings;
}>();

const emit = defineEmits<{
  (e: "update", settings: Partial<TemplateSettings>): void;
}>();

const PREHEADER_MAX_LENGTH = 150;

const { t, format } = useI18n();

const fontsManager = requireInject(FONTS_MANAGER_KEY, "TemplateSettings");
const displayedFontFamily = computed(
  () =>
    fontSelectValue(props.settings.fontFamily).trim() ||
    fontsManager.defaultFont.value,
);
const fontFamilies = computed(() =>
  withCurrentFont(fontsManager.fonts.value, displayedFontFamily.value),
);

const widthPresets = [
  { value: 480, label: "480px" },
  { value: 600, label: "600px" },
  { value: 700, label: "700px" },
  { value: 800, label: "800px" },
];

// Default to every field: the key is absent whenever a consumer configured no
// `templateSettings`, and that config only ever narrows.
const allowedFields = inject(
  TEMPLATE_SETTINGS_FIELDS_KEY,
  new Set(ALL_TEMPLATE_SETTINGS_FIELDS),
);

function shows(field: TemplateSettingsField): boolean {
  return allowedFields.has(field);
}

// A card earns its heading only if it still has something to hold. Derived from
// the field→card map rather than hand-listed per card, so a new setting joins
// its card's gate the moment it joins the map.
function showsCard(card: TemplateSettingsCard): boolean {
  return ALL_TEMPLATE_SETTINGS_FIELDS.some(
    (field) => TEMPLATE_SETTINGS_FIELD_CARDS[field] === card && shows(field),
  );
}

// Tips is advice about the settings, so it rides on there being at least one:
// a Settings tab holding nothing but advice reads as a bug. Plain const, like
// the two helpers above — the allowlist is init-time config, not reactive
// state, and a `computed` here would imply it can change.
const showsAnyField = allowedFields.size > 0;

const isRtl = computed(() => resolveContentDirection(props.settings) === "rtl");

// Custom head: the textareas hold a draft so the verdict below each one
// follows every keystroke, while the setting is written once per edit (on
// `change`, i.e. blur) — one undo step for a block of CSS rather than one per
// character. The watch picks up undo, redo and locale switches.
type CustomHeadField = "customHeadCss" | "customHeadTags";
const customHeadDraft = ref<Record<CustomHeadField, string>>({
  customHeadCss: props.settings.customHeadCss ?? "",
  customHeadTags: props.settings.customHeadTags ?? "",
});
watch(
  () => [props.settings.customHeadCss, props.settings.customHeadTags],
  ([css, tags]) => {
    customHeadDraft.value = {
      customHeadCss: css ?? "",
      customHeadTags: tags ?? "",
    };
  },
);
const customHeadChecks = computed<Record<CustomHeadField, CustomHeadCheck>>(
  () => ({
    customHeadCss: checkCustomHeadCss(customHeadDraft.value.customHeadCss),
    customHeadTags: checkCustomHeadTags(customHeadDraft.value.customHeadTags),
  }),
);

function customHeadRefusalMessage(field: CustomHeadField): string | null {
  const check = customHeadChecks.value[field];
  if (check.status !== "refused") return null;
  const refusal = check.refusal;
  const messages = t.templateSettings.customHeadRefusal;
  switch (refusal.reason) {
    case "markup-in-css":
      return messages.markupInCss;
    case "forbidden-element":
      return format(messages.forbiddenElement, { element: refusal.element });
    case "event-handler":
      return format(messages.eventHandler, { attribute: refusal.attribute });
    case "unsafe-url":
      return format(messages.unsafeUrl, { attribute: refusal.attribute });
    case "unclosed-comment":
      return messages.unclosedComment;
    case "unclosed-tag":
      return messages.unclosedTag;
  }
}

// The two fields share one layout; only their words differ. Placeholders are
// code, not prose, so they are not translated.
const customHeadFields = computed(() =>
  [
    {
      field: "customHeadCss" as const,
      testId: "template-settings-custom-head-css",
      label: t.templateSettings.customHeadCss,
      hint: t.templateSettings.customHeadCssHint,
      placeholder: ".footer a { color: #666666; }",
    },
    {
      field: "customHeadTags" as const,
      testId: "template-settings-custom-head-tags",
      label: t.templateSettings.customHeadTags,
      hint: t.templateSettings.customHeadTagsHint,
      placeholder: '<meta name="x-apple-disable-message-reformatting">',
    },
  ].filter((entry) => shows(entry.field)),
);

function draftCustomHead(field: CustomHeadField, event: Event): void {
  customHeadDraft.value = {
    ...customHeadDraft.value,
    [field]: (event.target as HTMLTextAreaElement).value,
  };
}

// Stored as typed, refused or not, so the author can fix it; blank is unset.
function commitCustomHead(field: CustomHeadField, event: Event): void {
  const value = (event.target as HTMLTextAreaElement).value;
  emit("update", { [field]: value.trim() === "" ? undefined : value });
}

// Cards lay their contents out with a flex gap rather than a bottom margin on
// every child but the last. A margin leaves dead space under whichever field
// became last once an excluded one is dropped, and which field that is depends
// on the consumer's allowlist — so there is no "last" to special-case.
const cardStackClass = `${cardClass} tpl:flex tpl:flex-col tpl:gap-3.5`;
</script>

<template>
  <aside
    data-testid="template-settings"
    class="tpl:flex tpl:w-full tpl:flex-1 tpl:flex-col tpl:bg-[var(--tpl-bg-elevated)]"
  >
    <div
      class="tpl:flex tpl:flex-1 tpl:flex-col tpl:gap-3 tpl:overflow-y-auto tpl:p-4"
    >
      <!-- Layout card -->
      <div
        v-if="showsCard('layout')"
        :class="cardStackClass"
        data-testid="template-settings-card-layout"
      >
        <div
          class="tpl:flex tpl:items-center tpl:gap-2 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          <Square
            class="tpl:text-[var(--tpl-text-muted)]"
            :size="14"
            :stroke-width="2"
          />
          <span>{{ t.templateSettings.layout }}</span>
        </div>

        <div v-if="shows('width')" data-testid="template-settings-width-preset">
          <FieldRow
            path="width"
            settings
            :label="t.templateSettings.widthPreset"
          />
          <div
            class="tpl:grid tpl:grid-cols-4 tpl:gap-1 tpl:rounded-[var(--tpl-radius-sm)] tpl:p-1 tpl:bg-[var(--tpl-bg-hover)]"
          >
            <button
              v-for="preset in widthPresets"
              :key="preset.value"
              class="tpl:cursor-pointer tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:px-2 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)]"
              :style="{
                backgroundColor:
                  settings.width === preset.value
                    ? 'var(--tpl-bg)'
                    : 'transparent',
                color:
                  settings.width === preset.value
                    ? 'var(--tpl-primary)'
                    : 'var(--tpl-text-muted)',
                boxShadow:
                  settings.width === preset.value
                    ? 'var(--tpl-shadow)'
                    : 'none',
              }"
              @click="emit('update', { width: preset.value })"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <div v-if="shows('width')" data-testid="template-settings-width-custom">
          <FieldRow
            path="width"
            settings
            :label="t.templateSettings.customWidth"
          />
          <div class="tpl:flex tpl:items-stretch">
            <input
              type="number"
              :class="inputGroupInputClass"
              :value="settings.width"
              min="300"
              max="900"
              @input="
                emit('update', {
                  width: Number(($event.target as HTMLInputElement).value),
                })
              "
            />
            <span :class="inputSuffixClass">px</span>
          </div>
        </div>
      </div>

      <!-- Appearance card -->
      <div
        v-if="showsCard('appearance')"
        :class="cardStackClass"
        data-testid="template-settings-card-appearance"
      >
        <div
          class="tpl:flex tpl:items-center tpl:gap-2 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          <Circle
            class="tpl:text-[var(--tpl-text-muted)]"
            :size="14"
            :stroke-width="2"
          />
          <span>{{ t.templateSettings.appearance }}</span>
        </div>

        <div
          v-if="shows('backgroundColor')"
          data-testid="template-settings-background"
        >
          <FieldRow
            path="backgroundColor"
            settings
            :label="t.templateSettings.backgroundColor"
          />
          <ColorPicker
            :model-value="settings.backgroundColor"
            :placeholder="DEFAULT_BG_COLOR"
            @update:model-value="emit('update', { backgroundColor: $event })"
          />
        </div>

        <div
          v-if="shows('textColor')"
          data-testid="template-settings-text-color"
        >
          <FieldRow
            path="textColor"
            settings
            :label="t.templateSettings.textColor"
          />
          <ColorPicker
            :model-value="settings.textColor ?? ''"
            seed-color="#1a1a1a"
            @update:model-value="emit('update', { textColor: $event })"
          />
        </div>

        <div
          v-if="shows('linkColor')"
          data-testid="template-settings-link-color"
        >
          <FieldRow
            path="linkColor"
            settings
            :label="t.templateSettings.linkColor"
          />
          <ColorPicker
            :model-value="settings.linkColor ?? ''"
            seed-color="#0066cc"
            @update:model-value="
              emit('update', { linkColor: $event || undefined })
            "
          />
        </div>

        <div
          v-if="shows('linkUnderline')"
          data-testid="template-settings-link-underline"
        >
          <FieldRow
            path="linkUnderline"
            settings
            :label="t.templateSettings.linkUnderline"
            ><template #label-actions="{ controlId }"
              ><ToggleSwitch
                :control-id="controlId"
                hide-label
                class="tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
                :model-value="settings.linkUnderline"
                :label="t.templateSettings.linkUnderline"
                @update:model-value="
                  emit('update', { linkUnderline: $event })
                " /></template
          ></FieldRow>
        </div>

        <div
          v-if="shows('fontFamily')"
          data-testid="template-settings-font-family"
        >
          <FieldRow
            path="fontFamily"
            settings
            :label="t.templateSettings.fontFamily"
          />
          <select
            :class="inputClass"
            :value="displayedFontFamily"
            @change="
              emit('update', {
                fontFamily: ($event.target as HTMLSelectElement).value,
              })
            "
          >
            <option
              v-for="font in fontFamilies"
              :key="font.value"
              :value="font.value"
            >
              {{ font.label }}
            </option>
          </select>
        </div>
      </div>

      <!-- Language card -->
      <div
        v-if="showsCard('language')"
        :class="cardStackClass"
        data-testid="template-settings-card-language"
      >
        <div
          class="tpl:flex tpl:items-center tpl:gap-2 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          <Globe
            class="tpl:text-[var(--tpl-text-muted)]"
            :size="14"
            :stroke-width="2"
          />
          <span>{{ t.templateSettings.language }}</span>
        </div>

        <div v-if="shows('locale')" data-testid="template-settings-locale">
          <label :class="labelClass">{{
            t.templateSettings.contentLocale
          }}</label>
          <input
            type="text"
            :class="inputClass"
            :value="settings.locale ?? ''"
            placeholder="en"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            @input="
              emit('update', {
                locale:
                  ($event.target as HTMLInputElement).value.trim() || undefined,
              })
            "
          />
          <p
            class="tpl:mt-1 tpl:text-xs tpl:leading-relaxed tpl:text-[var(--tpl-text-dim)]"
          >
            {{ t.templateSettings.contentLocaleHint }}
          </p>
        </div>

        <div
          v-if="shows('direction')"
          data-testid="template-settings-direction"
        >
          <FieldRow
            path="direction"
            settings
            :label="t.templateSettings.contentDirection"
            ><template #label-actions="{ controlId }"
              ><ToggleSwitch
                :control-id="controlId"
                hide-label
                class="tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
                :model-value="isRtl"
                :label="t.templateSettings.contentDirection"
                @update:model-value="
                  emit('update', { direction: $event ? 'rtl' : 'ltr' })
                " /></template
          ></FieldRow>
          <p
            class="tpl:mt-1 tpl:text-xs tpl:leading-relaxed tpl:text-[var(--tpl-text-dim)]"
          >
            {{ t.templateSettings.contentDirectionHint }}
          </p>
        </div>
      </div>

      <!-- Preheader card -->
      <div
        v-if="showsCard('preheader')"
        :class="cardStackClass"
        data-testid="template-settings-card-preheader"
      >
        <div
          class="tpl:flex tpl:items-center tpl:gap-2 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          <Eye
            class="tpl:text-[var(--tpl-text-muted)]"
            :size="14"
            :stroke-width="2"
          />
          <span>{{ t.templateSettings.preheaderText }}</span>
        </div>

        <div
          v-if="shows('preheaderText')"
          data-testid="template-settings-preheader"
        >
          <FieldRow
            path="preheaderText"
            settings
            :label="t.templateSettings.preheaderText"
          />
          <MergeTagTextarea
            :model-value="settings.preheaderText ?? ''"
            :placeholder="t.templateSettings.preheaderTextPlaceholder"
            :rows="2"
            @update:model-value="
              emit('update', {
                preheaderText: $event.replace(/[\r\n]/g, ' ') || undefined,
              })
            "
          />
          <div
            class="tpl:mt-1 tpl:flex tpl:items-start tpl:justify-between tpl:gap-2"
          >
            <span
              class="tpl:text-xs tpl:leading-relaxed tpl:text-[var(--tpl-text-dim)]"
            >
              {{ t.templateSettings.preheaderTextHint }}
            </span>
            <span
              class="tpl:shrink-0 tpl:text-xs tpl:tabular-nums tpl:text-[var(--tpl-text-dim)]"
            >
              {{ (settings.preheaderText ?? "").length }}/{{
                PREHEADER_MAX_LENGTH
              }}
            </span>
          </div>
        </div>
      </div>

      <!-- Custom head card -->
      <div
        v-if="showsCard('head')"
        :class="cardStackClass"
        data-testid="template-settings-card-head"
      >
        <div
          class="tpl:flex tpl:items-center tpl:gap-2 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
        >
          <Code
            class="tpl:text-[var(--tpl-text-muted)]"
            :size="14"
            :stroke-width="2"
          />
          <span>{{ t.templateSettings.customHead }}</span>
        </div>

        <div
          v-for="entry in customHeadFields"
          :key="entry.field"
          :data-testid="entry.testId"
        >
          <FieldRow
            v-slot="{ controlId }"
            :path="entry.field"
            settings
            :label="entry.label"
          >
            <textarea
              :id="controlId"
              :value="customHeadDraft[entry.field]"
              :placeholder="entry.placeholder"
              rows="5"
              spellcheck="false"
              autocapitalize="off"
              autocomplete="off"
              :class="monoTextareaClass"
              :aria-invalid="customHeadRefusalMessage(entry.field) !== null"
              @input="draftCustomHead(entry.field, $event)"
              @change="commitCustomHead(entry.field, $event)"
            />
          </FieldRow>
          <p
            v-if="customHeadRefusalMessage(entry.field) !== null"
            role="alert"
            class="tpl:mt-1 tpl:text-xs tpl:leading-relaxed tpl:text-[var(--tpl-danger)]"
            data-testid="template-settings-custom-head-refusal"
          >
            {{ customHeadRefusalMessage(entry.field) }}
          </p>
          <p
            v-else
            class="tpl:mt-1 tpl:text-xs tpl:leading-relaxed tpl:text-[var(--tpl-text-dim)]"
          >
            {{ entry.hint }}
          </p>
        </div>
      </div>

      <!-- Tips card -->
      <div
        v-if="showsAnyField"
        class="tpl:rounded-[var(--tpl-radius)] tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:p-3"
        data-testid="template-settings-card-tips"
      >
        <div
          class="tpl:mb-2.5 tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text-muted)]"
        >
          <Info :size="14" :stroke-width="2" />
          <span>{{ t.templateSettings.tips }}</span>
        </div>
        <ul
          class="tpl:m-0 tpl:list-disc tpl:pl-[18px] tpl:text-xs tpl:leading-relaxed tpl:text-[var(--tpl-text-dim)]"
        >
          <li class="tpl:mb-1 tpl:last:mb-0">
            {{ t.templateSettings.tip1 }}
          </li>
          <li class="tpl:mb-1 tpl:last:mb-0">
            {{ t.templateSettings.tip2 }}
          </li>
          <li class="tpl:mb-1 tpl:last:mb-0">
            {{ t.templateSettings.tip3 }}
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>
