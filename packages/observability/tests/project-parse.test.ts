import { expect, test } from "vite-plus/test";
import {
  itemsByNumber,
  parseProjectUrl,
  readAllProjectItems,
  readPageInfo,
  readProjectItems,
  readStatusField,
  statusChangeFor,
} from "../src/project.ts";
import { NONE } from "../src/none.ts";

const ISSUE = 5;
const SKIPPED = 9;
const PAGE_SIZE = 100;
const TWO_PAGES = 150;
const SECOND_PAGE_START = 101;

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

test("readProjectItems lifts items (number + repo + status), skipping any node with no id", () => {
  const data = {
    node: {
      items: {
        nodes: [
          {
            content: { number: ISSUE, repository: { nameWithOwner: "vndredev/vow" } },
            fieldValueByName: { name: "In Progress" },
            id: "I1",
          },
          { content: { number: SKIPPED } },
        ],
      },
    },
  };
  const items = readProjectItems(data);
  expect(items.map((item) => item.id)).toEqual(["I1"]);
  expect(items[0]?.number).toBe(ISSUE);
  expect(items[0]?.nameWithOwner).toBe("vndredev/vow");
  expect(items[0]?.status).toBe("In Progress");
});

test("itemsByNumber keeps only the current repo's items — a foreign collision is excluded", () => {
  const items = readProjectItems({
    node: {
      items: {
        nodes: [
          {
            content: { number: ISSUE, repository: { nameWithOwner: "vndredev/vow" } },
            fieldValueByName: { name: "Todo" },
            id: "OURS",
          },
          {
            content: { number: ISSUE, repository: { nameWithOwner: "other/repo" } },
            fieldValueByName: { name: "Done" },
            id: "FOREIGN",
          },
        ],
      },
    },
  });
  // Two items share #5; only the one from this repo is indexed — the foreign one cannot be written.
  const byNumber = itemsByNumber(items, "vndredev/vow");
  expect(byNumber.get(ISSUE)?.id).toBe("OURS");
  // With no resolvable current repo (offline degrade), nothing matches — safer than a wrong write.
  expect(itemsByNumber(items, NONE).size).toBe(0);
});

test("statusChangeFor reports a change only when the current status differs from the wanted", () => {
  expect(statusChangeFor("In Progress", ISSUE, "Done")).toEqual({
    from: "In Progress",
    number: ISSUE,
    to: "Done",
  });
  expect(statusChangeFor("Done", ISSUE, "Done")).toBeUndefined();
});

test("readPageInfo lifts hasNextPage + endCursor, defaulting hasNextPage false when malformed", () => {
  const data = { node: { items: { pageInfo: { endCursor: "CUR", hasNextPage: true } } } };
  expect(readPageInfo(data)).toEqual({ endCursor: "CUR", hasNextPage: true });
  expect(readPageInfo({ node: { items: {} } }).hasNextPage).toBe(false);
  expect(readPageInfo({}).hasNextPage).toBe(false);
});

/** A fixture page spec: `count` items numbered from `start`, with the connection's next-page cursor. */
interface PageSpec {
  readonly count: number;
  readonly endCursor: string;
  readonly hasNextPage: boolean;
  readonly start: number;
}

/** Build one graphql items page (`node.items`) from a spec — the shape `readAllProjectItems` walks. */
function page(spec: Readonly<PageSpec>): Record<string, unknown> {
  const nodes = Array.from({ length: spec.count }, (_unused, offset) => ({
    content: { number: spec.start + offset },
    fieldValueByName: { name: "Todo" },
    id: `I${spec.start + offset}`,
  }));
  return {
    node: {
      items: { nodes, pageInfo: { endCursor: spec.endCursor, hasNextPage: spec.hasNextPage } },
    },
  };
}

test("readAllProjectItems walks every page via the cursor — items beyond the first 100 are NOT lost", () => {
  // Two pages (150 items): the old single `first:100` read was blind to #101..#150.
  const byCursor = new Map<string, Record<string, unknown>>([
    ["", page({ count: PAGE_SIZE, endCursor: "CUR1", hasNextPage: true, start: 1 })],
    [
      "CUR1",
      page({
        count: TWO_PAGES - PAGE_SIZE,
        endCursor: "CUR2",
        hasNextPage: false,
        start: SECOND_PAGE_START,
      }),
    ],
  ]);
  const seen: string[] = [];
  const items = readAllProjectItems((cursor) => {
    seen.push(cursor ?? "(first)");
    return byCursor.get(cursor ?? "") ?? {};
  });
  // The loop started with no cursor, then resumed after the first page's endCursor.
  expect(seen).toEqual(["(first)", "CUR1"]);
  expect(items).toHaveLength(TWO_PAGES);
  // The item past 100 — the one that stayed stuck "In Progress" — is now seen.
  expect(items.map((item) => item.number)).toContain(SECOND_PAGE_START);
});

test("readAllProjectItems stops on the first page when hasNextPage is false", () => {
  let calls = 0;
  const items = readAllProjectItems(() => {
    calls += 1;
    return page({ count: 1, endCursor: "END", hasNextPage: false, start: 1 });
  });
  expect(calls).toBe(1);
  expect(items).toHaveLength(1);
});

test("parseProjectUrl lifts the owner login + number from a user or org Project URL", () => {
  const PROJECT_3 = 3;
  expect(parseProjectUrl("https://github.com/users/vndredev/projects/3")).toEqual({
    login: "vndredev",
    number: PROJECT_3,
  });
  expect(parseProjectUrl("https://github.com/orgs/acme/projects/3")).toEqual({
    login: "acme",
    number: PROJECT_3,
  });
  expect(parseProjectUrl("https://github.com/vndredev/vow")).toBeUndefined();
});
