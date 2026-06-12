// @vitest-environment node
import { expect, test } from "vite-plus/test";
import { serveBanner } from "../src/serve.ts";

const STUDIO_PORT = 5173;
const DOCS_PORT = 5174;

test("serveBanner names the local hub and lists each surface's URL (#491)", () => {
  const banner = serveBanner([
    { port: STUDIO_PORT, slug: "studio" },
    { port: DOCS_PORT, slug: "docs" },
  ]);
  expect(banner).toContain("vow serve — your local hub");
  expect(banner).toContain("the /__vow control API");
  expect(banner).toContain(`http://localhost:${STUDIO_PORT}/`);
  expect(banner).toContain(`http://localhost:${DOCS_PORT}/`);
});

test("serveBanner pads the slug column so the URLs align", () => {
  const banner = serveBanner([{ port: STUDIO_PORT, slug: "studio" }]);
  expect(banner).toContain(`  studio   http://localhost:${STUDIO_PORT}/`);
});
