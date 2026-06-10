import { expect, test } from "vite-plus/test";
import type { Page } from "../src/types.ts";
import { buildNav } from "../src/index.ts";

test("buildNav leads with Home + ungrouped pages, then each surface, ordered", () => {
  const pages: Page[] = [
    { group: "Plan", icon: "list-checks", order: 2, path: "/board", title: "Board" },
    { group: "Plan", order: 1, path: "/roadmap", title: "Roadmap" },
    { icon: "list-checks", path: "/tasks", title: "Tasks" },
  ];
  const sections = buildNav(pages);

  /* First section: headerless — Home (with its own icon) + the ungrouped page. */
  expect(sections[0]?.title).toBeUndefined();
  expect(sections[0]?.items.map((item) => item.title)).toEqual(["Home", "Tasks"]);
  expect(sections[0]?.items[0]?.icon).toBe("home");

  /* The "Plan" surface — its own header, items sorted by `order` (Roadmap 1 before Board 2). */
  expect(sections[1]?.title).toBe("Plan");
  expect(sections[1]?.items.map((item) => item.title)).toEqual(["Roadmap", "Board"]);
  /* The icon is carried through. */
  expect(sections[1]?.items[1]?.icon).toBe("list-checks");
});

test("buildNav with no pages is just Home", () => {
  expect(buildNav([])).toEqual([{ items: [{ icon: "home", path: "/", title: "Home" }] }]);
});
