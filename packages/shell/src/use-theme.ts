import { computed, ref } from "vue";

/*
 * Shared tri-state theme state. One module-level ref backs every DarkToggle instance (the desktop sidebar
 * AND the mobile drawer render one each), so they never drift. The `.dark` class is set before first paint
 * by the app's index.html (no flash); an explicit choice persists in localStorage, "system" clears it.
 * Outside a browser (SSR / a jsdom test that imports this) every DOM touch is guarded — the ref still works.
 */
type Theme = "dark" | "light" | "system";

/*
 * The ref/computed types are derived from `ref`/`computed` themselves — a value + type pair from one
 * module ("vue") is forbidden by the import rules, so the module imports only the values. `computed`
 * over a getter is read-only, so `IconRef` is taken from a getter call (not the writable overload).
 */
const iconSample = computed((): string => "");
type ThemeRef = ReturnType<typeof ref<Theme>>;
type IconRef = typeof iconSample;

/** The shared theme handle: the current value, its icon, and `cycle()` (system to light to dark). */
interface ThemeHandle {
  readonly cycle: () => void;
  readonly icon: IconRef;
  readonly theme: ThemeRef;
}

const theme = ref<Theme>("system");
let started = false;

/* Environment probes — `in globalThis` keeps both the `undefined` literal and `typeof undefined` away. */
const hasDom = "window" in globalThis && "document" in globalThis;
const hasStorage = "localStorage" in globalThis;
const hasMatchMedia = "matchMedia" in globalThis;

function prefersDark(): boolean {
  return hasMatchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
}

function darkFor(next: Theme): boolean {
  if (next === "system") {
    return prefersDark();
  }
  return next === "dark";
}

function persist(next: Theme): void {
  if (!hasStorage) {
    return;
  }
  if (next === "system") {
    localStorage.removeItem("vow-theme");
  } else {
    localStorage.setItem("vow-theme", next);
  }
}

function apply(next: Theme): void {
  theme.value = next;
  /* No DOM — the value is the only state. */
  if (!hasDom) {
    return;
  }
  document.documentElement.classList.toggle("dark", darkFor(next));
  persist(next);
}

function nextTheme(current: Theme): Theme {
  if (current === "system") {
    return "light";
  }
  if (current === "light") {
    return "dark";
  }
  return "system";
}

function iconFor(current: Theme): string {
  if (current === "system") {
    return "monitor";
  }
  if (current === "dark") {
    return "moon";
  }
  return "sun";
}

function storedTheme(): Theme {
  if (!hasStorage) {
    return "system";
  }
  const stored = localStorage.getItem("vow-theme");
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return "system";
}

/**
 * The minimal, deeply-readonly shape this listener cares about — every `MediaQueryListEvent` satisfies
 * it, so the DOM listener can pass its event straight through.
 */
interface ThemeChange {
  readonly matches: boolean;
}

function onSystemChange(event: ThemeChange): void {
  if (theme.value === "system") {
    document.documentElement.classList.toggle("dark", event.matches);
  }
}

function start(): void {
  started = true;
  theme.value = storedTheme();
  if (!hasMatchMedia) {
    return;
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", onSystemChange);
}

/** The shared theme: the current value, its icon, and a `cycle()` (system to light to dark to system). */
export function useTheme(): ThemeHandle {
  if (!started && hasDom) {
    start();
  }
  const icon = computed(() => iconFor(theme.value));
  const cycle = (): void => {
    apply(nextTheme(theme.value));
  };
  return { cycle, icon, theme };
}
