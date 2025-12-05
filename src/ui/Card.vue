<template>
  <component
    :is="as"
    :class="[
      baseClass,
      paddingClass,
      variantClass,
      $attrs.class ?? ''
    ]"
    v-bind="cleanAttrs"
  >
    <slot />
  </component>
</template>

<script setup>
import { computed, useAttrs } from "vue";

const props = defineProps({
  variant: {
    type: String,
    default: "default", // default | outline | elevated | transparent
  },
  padding: {
    type: String,
    default: "md", // sm | md | lg
  },
  as: {
    type: String,
    default: "section",
  }
});

const attrs = useAttrs();

// базовий клас — твій card
const baseClass = "card";

// padding варіанти
const paddingClass = computed(() => {
  return {
    sm: "p-3",
    md: "p-6",
    lg: "p-10",
  }[props.padding] ?? "p-6";
});

// variants
const variantClass = computed(() => {
  switch (props.variant) {
    case "outline":
      return "card-outline";
    case "elevated":
      return "card-elevated";
    case "transparent":
      return "card-transparent";
    default:
      return "";
  }
});

// очищаємо attrs від class (щоб уникнути дублювання)
const cleanAttrs = computed(() => {
  const { class: _omit, ...rest } = attrs;
  return rest;
});
</script>
