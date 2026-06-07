<script setup lang="ts">
// The landing page (frontmatter `layout: home`): a hero + a feature grid, like the VitePress home.
interface Action {
  readonly theme?: string;
  readonly text: string;
  readonly link: string;
}
interface Hero {
  readonly name?: string;
  readonly text?: string;
  readonly tagline?: string;
  readonly actions?: readonly Action[];
}
interface Feature {
  readonly title: string;
  readonly details: string;
}

defineProps<{ hero: Hero; features?: readonly Feature[] }>();
</script>

<template>
  <div class="vow-home">
    <section class="vow-home__hero">
      <h1 v-if="hero.name" class="vow-home__name">{{ hero.name }}</h1>
      <p v-if="hero.text" class="vow-home__text">{{ hero.text }}</p>
      <p v-if="hero.tagline" class="vow-home__tagline">{{ hero.tagline }}</p>
      <div v-if="hero.actions?.length" class="vow-home__actions">
        <a
          v-for="action in hero.actions"
          :key="action.link"
          :href="action.link"
          class="vow-home__action"
          :class="`vow-home__action--${action.theme ?? 'brand'}`"
          >{{ action.text }}</a
        >
      </div>
    </section>
    <section v-if="features && features.length > 0" class="vow-home__features">
      <article v-for="feature in features" :key="feature.title" class="vow-home__feature">
        <h2 class="vow-home__feature-title">{{ feature.title }}</h2>
        <p class="vow-home__feature-details">{{ feature.details }}</p>
      </article>
    </section>
  </div>
</template>
