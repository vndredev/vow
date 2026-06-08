import { expect, test } from "vite-plus/test";
import { useCollection } from "../src/index.ts";

test("useCollection shares one reactive array per slug; different slugs are separate", () => {
  const a = useCollection<{ id: string }>("widget");
  const b = useCollection<{ id: string }>("widget");
  a.append({ id: "1" });
  expect(b.items).toHaveLength(1); // same underlying array
  expect(useCollection("gadget").items).toHaveLength(0); // a different slug is its own collection
  b.removeAt(0);
  expect(a.items).toHaveLength(0);
});
