import { createApp } from "vue";
// A real .vue file — generated from app/welcome-card/vow.md into .generated/ (hidden, gitignored,
// regenerated, vue-tsc-checked). Inspectable, but never the source: the vow.md is the truth.
import WelcomeCard from "../.generated/welcome-card.vue";

createApp(WelcomeCard).mount("#app");
