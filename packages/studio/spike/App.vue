<script setup lang="ts">
// P0 spike fixture: a plain SFC the SSR test compiles + server-renders. Stands in for a real page
// component (props + a slot for body content) until the markdown pipeline emits these for real.
defineProps<{ title: string }>();
</script>

<template>
  <article class="vow-doc">
    <h1>{{ title }}</h1>
    <slot />
  </article>
</template>
