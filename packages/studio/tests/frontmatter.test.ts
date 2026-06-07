import { expect, test } from "vite-plus/test";
import { splitFrontmatter } from "../src/markdown/frontmatter.ts";

test("splits YAML frontmatter from the body", () => {
  const { data, body } = splitFrontmatter("---\ntitle: Hello\norder: 2\n---\n# Body\n");
  expect(data["title"]).toBe("Hello");
  expect(data["order"]).toBe(2);
  expect(body).toBe("# Body\n");
});

test("returns the whole input as the body when there is no frontmatter", () => {
  const { data, body } = splitFrontmatter("# Just markdown\n");
  expect(data).toEqual({});
  expect(body).toBe("# Just markdown\n");
});
