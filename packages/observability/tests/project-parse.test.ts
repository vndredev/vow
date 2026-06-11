import { expect, test } from "vite-plus/test";
import { readProjectItems, readStatusField } from "../src/project.ts";

const ISSUE = 5;
const SKIPPED = 9;

test("readStatusField lifts the field id + its single-select options", () => {
  const data = {
    node: {
      field: {
        id: "F1",
        options: [
          { id: "O1", name: "Todo" },
          { id: "O2", name: "Done" },
        ],
      },
    },
  };
  expect(readStatusField(data)).toEqual({
    id: "F1",
    options: [
      { id: "O1", name: "Todo" },
      { id: "O2", name: "Done" },
    ],
  });
});

test("readStatusField throws when the Project has no Status field", () => {
  expect(() => readStatusField({ node: {} })).toThrow();
});

test("readProjectItems lifts items (number + status), skipping any node with no id", () => {
  const data = {
    node: {
      items: {
        nodes: [
          { content: { number: ISSUE }, fieldValueByName: { name: "In Progress" }, id: "I1" },
          { content: { number: SKIPPED } },
        ],
      },
    },
  };
  const items = readProjectItems(data);
  expect(items.map((item) => item.id)).toEqual(["I1"]);
  expect(items[0]?.number).toBe(ISSUE);
  expect(items[0]?.status).toBe("In Progress");
});
