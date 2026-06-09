import { computed, type ComputedRef, ref, type Ref } from "vue";

// Shared tri-state theme state. One module-level ref backs every DarkToggle instance (the desktop sidebar
// AND the mobile drawer render one each), so they never drift. The `.dark` class is set before first paint
// by the app's index.html (no flash); an explicit choice persists in localStorage, "system" clears it.
// Outside a browser (SSR / a jsdom test that imports this) every DOM touch is guarded — the ref still works.
type Theme = "system" | "light" | "dark";
const theme = ref<Theme>("system");
let started = false;

const hasDom = typeof window !== "undefined" && typeof document !== "undefined";

function prefersDark(): boolean {
  return (
    hasDom && typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function apply(next: Theme): void {
  theme.value = next;
  if (!hasDom) return; // no DOM — the value is the only state
  document.documentElement.classList.toggle(
    "dark",
    next === "system" ? prefersDark() : next === "dark",
  );
  if (typeof localStorage !== "undefined") {
    if (next === "system") localStorage.removeItem("vow-theme");
    else localStorage.setItem("vow-theme", next);
  }
}

/** The shared theme: the current value, its icon, and a `cycle()` (system → light → dark → system). */
export function useTheme(): { theme: Ref<Theme>; icon: ComputedRef<string>; cycle: () => void } {
  if (!started && hasDom) {
    started = true;
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("vow-theme") : null;
    theme.value = stored === "light" || stored === "dark" ? stored : "system";
    if (typeof matchMedia === "function") {
      matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        if (theme.value === "system") document.documentElement.classList.toggle("dark", e.matches);
      });
    }
  }
  const icon = computed(() =>
    theme.value === "system" ? "monitor" : theme.value === "dark" ? "moon" : "sun",
  );
  const cycle = (): void =>
    apply(theme.value === "system" ? "light" : theme.value === "light" ? "dark" : "system");
  return { theme, icon, cycle };
}
