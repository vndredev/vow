// @vitest-environment jsdom
import { elementHint, resolveVowSource } from "../src/client/bug-reporter.ts";
import { expect, test } from "vite-plus/test";
import { parseReport, reportBody } from "../src/issue-report.ts";
import { NONE } from "../src/none.ts";
import { devOverlayTags } from "../src/virtual.ts";

test("resolveVowSource walks up to the nearest data-vow-source — DOM → spec", () => {
  document.body.innerHTML = `<div data-vow-source="home"><section><button class="go">hi</button></section></div>`;
  const button = document.querySelector(".go");
  expect(resolveVowSource(button)).toBe("home");
});

test("resolveVowSource is empty outside any generated root or for an absent element", () => {
  document.body.innerHTML = `<div><span class="loose">x</span></div>`;
  expect(resolveVowSource(document.querySelector(".loose"))).toBe("");
  // A non-matching query yields the absent (null) element — the resolver returns "".
  expect(resolveVowSource(document.querySelector(".nope"))).toBe("");
});

test("elementHint names the tag + its classes (the bug/feature area)", () => {
  document.body.innerHTML = `<button class="vow-board__card primary">x</button>`;
  const button = document.querySelector("button");
  if (!button) {
    throw new Error("test setup: button missing");
  }
  expect(elementHint(button)).toBe("button.vow-board__card.primary");
});

test("devOverlayTags injects the reporter bootstrap in dev, nothing in a build", () => {
  const dev = devOverlayTags(true);
  expect(dev).toHaveLength(1);
  expect(dev[0]?.attrs.src).toContain("dev-overlay");
  expect(dev[0]?.injectTo).toBe("body");
  expect(devOverlayTags(false)).toEqual([]);
});

test("parseReport validates a posted bug/feature report, rejecting bad shapes", () => {
  const ok = parseReport(JSON.stringify({ kind: "feature", source: "home", title: "Add X" }));
  expect(ok?.kind).toBe("feature");
  expect(ok?.title).toBe("Add X");
  expect(ok?.source).toBe("home");
  // An unknown kind, a missing title, and malformed JSON all reject.
  expect(parseReport(JSON.stringify({ kind: "chore", title: "x" }))).toBeUndefined();
  expect(parseReport(JSON.stringify({ kind: "bug" }))).toBeUndefined();
  expect(parseReport("not json")).toBeUndefined();
});

test("reportBody fills the bug template (the gate's sections) + references the screenshot when saved", () => {
  const report = parseReport(
    JSON.stringify({ description: "broken", kind: "bug", route: "/board", title: "x" }),
  );
  if (!report) {
    throw new Error("test setup: report missing");
  }
  const body = reportBody(report, ".vow/bugs/1.png");
  // The issue-template gate requires these exact substrings for a bug — keep this in sync with it.
  for (const section of ["What happened", "Relevant output", "Environment"]) {
    expect(body).toContain(section);
  }
  expect(body).toContain(".vow/bugs/1.png");
  expect(reportBody(report, NONE)).not.toContain("Screenshot");
});

test("reportBody fills the feature template (Why + Strand) for a feature kind", () => {
  const report = parseReport(JSON.stringify({ description: "add X", kind: "feature", title: "x" }));
  if (!report) {
    throw new Error("test setup: report missing");
  }
  const body = reportBody(report, NONE);
  for (const section of ["What", "Why", "Strand"]) {
    expect(body).toContain(section);
  }
});
