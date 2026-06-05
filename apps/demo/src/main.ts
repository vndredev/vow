import { createApp } from "vue";
// A real .vue file — generated from .vow/welcome-card/vow.md into .vow/generated/ (gitignored,
// regenerated, vue-tsc-checked). Inspectable, but never the source: the vow.md is the truth.
import WelcomeCard from "../.vow/generated/welcome-card.vue";

createApp(WelcomeCard).mount("#app");
