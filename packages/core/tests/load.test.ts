import { expect, test } from "vite-plus/test";
import { validateIcons, validateReferences } from "../src/load.ts";

/** The read-only vow + field shapes, derived from `validateReferences` so only the value is imported. */
type Vow = Parameters<typeof validateReferences>[0][number];
type Field = NonNullable<Vow["fields"]>[number];

const entity = (slug: string, fields: readonly Field[]): Vow => ({
  children: [],
  fields,
  fulfills: { as: "entity", kind: "emit" },
  id: `vow_${slug}`,
  intent: "An entity",
  proof: [],
  slug,
});

/** The icon names the membership check is run against (a small stand-in for the real @vow/icons list). */
const ICONS: readonly string[] = ["home", "users"];

/** A leaf page vow with a nav + view, the two surfaces an icon string is authored on. */
const page = (slug: string, nav: Vow["nav"], view: Vow["view"]): Vow => ({
  children: [],
  fields: [],
  fulfills: { as: "view", kind: "emit" },
  id: `vow_${slug}`,
  intent: "A page",
  nav,
  proof: [],
  slug,
  view,
});

test("validateReferences throws on a reference to a non-existent entity", () => {
  const issue = entity("issue", [
    { name: "assignee", ref: "ghost", required: false, type: "reference" },
  ]);
  expect(() => {
    validateReferences([issue]);
  }).toThrow(/ghost/u);
});

test("validateReferences passes when the reference target exists in the vows", () => {
  const user = entity("user", [{ name: "name", required: true, type: "text" }]);
  const issue = entity("issue", [
    { name: "assignee", ref: "user", required: false, type: "reference" },
  ]);
  expect(() => {
    validateReferences([user, issue]);
  }).not.toThrow();
});

test("validateIcons throws on an unknown nav icon", () => {
  const home = page("home", { icon: "hpme" }, []);
  expect(() => {
    validateIcons([home], ICONS);
  }).toThrow(/hpme/u);
});

test("validateIcons throws on an unknown view icon node", () => {
  const home = page("home", { icon: "home" }, [{ type: "icon", value: { name: "ghost" } }]);
  expect(() => {
    validateIcons([home], ICONS);
  }).toThrow(/ghost/u);
});

test("validateIcons throws on an unknown view link icon", () => {
  const home = page("home", { icon: "home" }, [
    { type: "link", value: { icon: "nope", to: "/x" } },
  ]);
  expect(() => {
    validateIcons([home], ICONS);
  }).toThrow(/nope/u);
});

test("validateIcons passes when every authored icon is a known name", () => {
  const home = page("home", { icon: "home" }, [
    { type: "icon", value: { name: "users" } },
    { type: "link", value: { icon: "home", to: "/x" } },
  ]);
  expect(() => {
    validateIcons([home], ICONS);
  }).not.toThrow();
});
