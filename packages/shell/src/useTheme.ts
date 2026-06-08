import { computed, type ComputedRef, ref, type Ref } from "vue";

// Shared tri-state theme state. One module-level ref backs every DarkToggle instance (the desktop sidebar
// AND the mobile drawer render one each), so they never drift. The `.dark` class is set before first paint
// by the app's index.html (no flash); an explicit choice persists in localStorage, "system" clears it.
type Theme = "system" | "light" | "dark";
const theme = ref<Theme>("system");
let started = false;

function apply(next: Theme): void {
  theme.value = next;
  const isDark =
    next === "system" ? matchMedia("(prefers-color-scheme: dark)").matches : next === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  if (next === "system") localStorage.removeItem("vow-theme");
  else localStorage.setItem("vow-theme", next);
}

/** The shared theme: the current value, its icon, and a `cycle()` (system → light → dark → system). */
export function useTheme(): { theme: Ref<Theme>; icon: ComputedRef<string>; cycle: () => void } {
  if (!started) {
    started = true;
    const stored = localStorage.getItem("vow-theme");
    theme.value = stored === "light" || stored === "dark" ? stored : "system";
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (theme.value === "system") document.documentElement.classList.toggle("dark", e.matches);
    });
  }
  const icon = computed(() =>
    theme.value === "system" ? "monitor" : theme.value === "dark" ? "moon" : "sun",
  );
  const cycle = (): void =>
    apply(theme.value === "system" ? "light" : theme.value === "light" ? "dark" : "system");
  return { theme, icon, cycle };
}
