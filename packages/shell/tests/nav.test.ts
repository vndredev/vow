import { expect, test } from "vite-plus/test";
import { buildNav, type Page } from "../src/index.ts";

test("buildNav leads with Home + ungrouped pages, then each surface, ordered", () => {
  const pages: Page[] = [
    { path: "/board", title: "Board", group: "Plan", order: 2, icon: "list-checks" },
    { path: "/roadmap", title: "Roadmap", group: "Plan", order: 1 },
    { path: "/tasks", title: "Tasks", icon: "list-checks" },
  ];
  const sections = buildNav(pages);

  // first section: headerless — Home (with its own icon) + the ungrouped page
  expect(sections[0]?.title).toBeUndefined();
  expect(sections[0]?.items.map((i) => i.title)).toEqual(["Home", "Tasks"]);
  expect(sections[0]?.items[0]?.icon).toBe("home");

  // the "Plan" surface — its own header, items sorted by `order` (Roadmap 1 before Board 2)
  expect(sections[1]?.title).toBe("Plan");
  expect(sections[1]?.items.map((i) => i.title)).toEqual(["Roadmap", "Board"]);
  expect(sections[1]?.items[1]?.icon).toBe("list-checks"); // the icon is carried through
});

test("buildNav with no pages is just Home", () => {
  expect(buildNav([])).toEqual([{ items: [{ path: "/", title: "Home", icon: "home" }] }]);
});
