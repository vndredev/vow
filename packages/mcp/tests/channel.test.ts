// @vitest-environment node
import { buildChannelServer, channelEvent } from "../src/channel.ts";
import { expect, test } from "vite-plus/test";

const ISSUE = 497;
const PR = 501;

test("channelEvent: content is `<kind>  <context>`, meta carries the typed fields as strings (#497)", () => {
  const { content, meta } = channelEvent({
    issue: ISSUE,
    kind: "run.phase",
    phase: "develop",
    ts: "t",
  });
  expect(content).toBe(`run.phase  ${ISSUE} · develop`);
  expect(meta).toEqual({ issue: String(ISSUE), kind: "run.phase", phase: "develop" });
});

test("channelEvent: a context-less event is just its kind; a pr event carries pr meta", () => {
  expect(channelEvent({ kind: "run.started", ts: "t" }).content).toBe("run.started");
  const merged = channelEvent({ kind: "pr.merged", pr: PR, ts: "t" });
  expect(merged.content).toBe(`pr.merged  ${PR}`);
  expect(merged.meta).toEqual({ kind: "pr.merged", pr: String(PR) });
});

test("buildChannelServer constructs the vow channel server (the experimental channel capability)", () => {
  expect(buildChannelServer()).toBeDefined();
});
