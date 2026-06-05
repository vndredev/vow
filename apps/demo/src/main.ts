import { createApp } from "vue";
// This component exists nowhere on disk — it is emitted from a vow, live, by @vow/vite-plugin.
import WelcomeCard from "virtual:vow/component/welcome-card";

createApp(WelcomeCard).mount("#app");
