<script setup lang="ts">
// The container target: `::: warning Title` in markdown becomes this. Styled by data-kind in vow.css.
defineProps<{ kind: string; title?: string }>();
</script>

<template>
  <div class="vow-callout" :data-kind="kind">
    <p v-if="title" class="vow-callout__title">{{ title }}</p>
    <div class="vow-callout__body"><slot /></div>
  </div>
</template>
