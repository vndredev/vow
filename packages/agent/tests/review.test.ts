import { buildReviewPrompt, parseReviewOutput, specFixPrompt } from "../src/review.ts";
import { expect, test } from "vite-plus/test";

test("buildReviewPrompt embeds the issue title and body in the instruction", () => {
  const prompt = buildReviewPrompt(
    "add a delete button",
    "Remove the selected item when the button is clicked.",
  );
  expect(prompt).toContain("add a delete button");
  expect(prompt).toContain("Remove the selected item");
  expect(prompt).toContain('"compliant": true');
  expect(prompt).toContain("Do NOT edit any file");
});

test("parseReviewOutput returns compliant=true from a valid JSON compliant result", () => {
  const result = parseReviewOutput('{"compliant": true, "feedback": ""}');
  expect(result.compliant).toBe(true);
  expect(result.feedback).toBe("");
});

test("parseReviewOutput returns compliant=false with the feedback from a non-compliant result", () => {
  const result = parseReviewOutput('{"compliant": false, "feedback": "missing test coverage"}');
  expect(result.compliant).toBe(false);
  expect(result.feedback).toBe("missing test coverage");
});

test("parseReviewOutput falls back to non-compliant when the JSON is malformed", () => {
  const result = parseReviewOutput("not json at all");
  expect(result.compliant).toBe(false);
  expect(result.feedback.length).toBeGreaterThan(0);
});

test("parseReviewOutput falls back to non-compliant when the JSON lacks the compliant field", () => {
  const result = parseReviewOutput('{"verdict": "ok"}');
  expect(result.compliant).toBe(false);
});

test("parseReviewOutput tolerates a missing feedback field — defaults to empty string", () => {
  const result = parseReviewOutput('{"compliant": true}');
  expect(result.compliant).toBe(true);
  expect(result.feedback).toBe("");
});

test("specFixPrompt embeds the reviewer feedback in the correction instruction", () => {
  const prompt = specFixPrompt("missing input validation");
  expect(prompt).toContain("missing input validation");
  expect(prompt).toContain("Correct this deviation");
});
