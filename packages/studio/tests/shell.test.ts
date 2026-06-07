import { expect, test } from "vite-plus/test";
import { renderToString } from "@vue/server-renderer";
import { createSSRApp, h, type VNode } from "vue";
import Callout from "../theme/Callout.vue";
import Nav from "../theme/Nav.vue";
import Sidebar from "../theme/Sidebar.vue";
import Toc from "../theme/Toc.vue";

const render = (node: VNode): Promise<string> =>
  renderToString(createSSRApp({ render: () => node }));

test("Callout renders its kind, title and slot", async () => {
  const html = await render(
    h(Callout, { kind: "warning", title: "Heads up" }, { default: () => h("p", "body text") }),
  );
  expect(html).toContain('data-kind="warning"');
  expect(html).toContain("Heads up");
  expect(html).toContain("body text");
});

test("Toc renders an outline that anchors to slug ids", async () => {
  const toc = [
    { level: 2, text: "Intro", slug: "intro" },
    { level: 3, text: "Details", slug: "details" },
  ];
  const html = await render(h(Toc, { toc }));
  expect(html).toContain('href="#intro"');
  expect(html).toContain("Details");
});

test("Sidebar renders grouped, nested links via the collapsible primitive", async () => {
  const groups = [
    {
      text: "UI",
      items: [
        {
          text: "Primitives",
          link: "/guide/primitives",
          items: [{ text: "Checkbox", link: "/guide/primitives/checkbox" }],
        },
      ],
    },
  ];
  const html = await render(h(Sidebar, { groups, currentPath: "/guide/primitives/checkbox" }));
  expect(html).toContain("UI");
  expect(html).toContain('href="/guide/primitives"');
  expect(html).toContain('href="/guide/primitives/checkbox"');
  expect(html).toContain('role="region"'); // the collapsible content region (dogfooded)
  expect(html).toContain("is-active"); // the current page is highlighted
});

test("Nav renders the title and configured links", async () => {
  const html = await render(
    h(Nav, { config: { title: "vow", nav: [{ text: "Guide", link: "/guide/" }] } }),
  );
  expect(html).toContain("vow");
  expect(html).toContain('href="/guide/"');
});
