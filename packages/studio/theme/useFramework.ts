import { ref, type Ref } from "vue";

/**
 * The framework the docs are currently shown for. vow's goal is one spec → many framework adapters;
 * today only Vue is generated (`renderVueSfc`), React/Solid are planned. The switcher lets a reader
 * pick a target; planned ones are shown honestly (a roadmap banner over the Vue reference output),
 * never as if they ship. State is module-global so the header switcher and every page block share it.
 */
export type FrameworkId = "vue" | "react" | "solid";

export interface FrameworkMeta {
  readonly id: FrameworkId;
  readonly label: string;
  readonly status: "available" | "planned";
}

const VUE: FrameworkMeta = { id: "vue", label: "Vue", status: "available" };

export const FRAMEWORKS: readonly FrameworkMeta[] = [
  VUE,
  { id: "react", label: "React", status: "planned" },
  { id: "solid", label: "Solid", status: "planned" },
];

const STORAGE_KEY = "vow-docs-framework";

// Defaults to "vue" so SSR and the first client render agree; the stored choice is only read after
// mount (initFramework), to avoid a hydration mismatch.
const framework = ref<FrameworkId>("vue");

export function useFramework(): Ref<FrameworkId> {
  return framework;
}

export function metaFor(id: FrameworkId): FrameworkMeta {
  return FRAMEWORKS.find((f) => f.id === id) ?? VUE;
}

/** Read the persisted choice — call once, after mount (client only). */
export function initFramework(): void {
  if (typeof localStorage === "undefined") return;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && FRAMEWORKS.some((f) => f.id === stored)) {
    framework.value = stored as FrameworkId;
  }
}

export function setFramework(id: FrameworkId): void {
  framework.value = id;
  if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, id);
}
