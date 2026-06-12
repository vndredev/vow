import {
  MAIN_PROTECTION,
  driftReport,
  parseProtection,
  protectionDrift,
  protectionPayload,
} from "../src/protection.ts";
import { expect, test } from "vite-plus/test";

test("protectionPayload encodes the invariant as the gh-api PUT body (PR-only · gate · no bypass)", () => {
  const body = protectionPayload(MAIN_PROTECTION);
  expect(body).toContain('"enforce_admins":true');
  expect(body).toContain('"gate"');
  expect(body).toContain('"required_approving_review_count":0');
});

test("parseProtection lifts the subset vow cares about from a gh protection object", () => {
  const json = JSON.stringify({
    enforce_admins: { enabled: true },
    required_pull_request_reviews: { required_approving_review_count: 0 },
    required_status_checks: { contexts: ["gate"] },
  });
  expect(parseProtection(json)).toEqual({
    checks: ["gate"],
    enforceAdmins: true,
    requirePr: true,
    reviews: 0,
  });
});

test("parseProtection falls back to the loose state for a partial gh object (drift IS the live path)", () => {
  expect(parseProtection("{}")).toEqual({
    checks: [],
    enforceAdmins: false,
    requirePr: false,
    reviews: 0,
  });
  const noReviews = JSON.stringify({ enforce_admins: { enabled: false } });
  expect(parseProtection(noReviews)).toEqual({
    checks: [],
    enforceAdmins: false,
    requirePr: false,
    reviews: 0,
  });
  const dirtyContexts = JSON.stringify({ required_status_checks: { contexts: ["gate", 1, true] } });
  expect(parseProtection(dirtyContexts).checks).toEqual(["gate"]);
});

test("protectionDrift flags a loosened protection, and is empty when it holds", () => {
  const loose = { checks: [], enforceAdmins: false, requirePr: false, reviews: 1 };
  const drift = protectionDrift(loose, MAIN_PROTECTION);
  // Each invariant must have its OWN drift line; a bare length check would let any one (e.g. the
  // NON-NEGOTIABLE enforce_admins guard) be dropped and still go green.
  expect(drift).toContain('the "gate" check is not required');
  expect(drift).toContain("a PR is not required");
  expect(drift).toContain("enforce_admins=false, want true");
  expect(drift).toContain("required reviews=1, want 0");
  const tight = { checks: ["gate"], enforceAdmins: true, requirePr: true, reviews: 0 };
  expect(protectionDrift(tight, MAIN_PROTECTION)).toEqual([]);
});

test("driftReport turns an empty drift into a green verdict the CI step passes on", () => {
  const verdict = driftReport([]);
  expect(verdict.ok).toBe(true);
  expect(verdict.report).toContain("main protection holds");
});

test("driftReport turns drift into a failing verdict, one line per drift the CI step prints", () => {
  const verdict = driftReport([
    'the "gate" check is not required',
    "enforce_admins=false, want true",
  ]);
  expect(verdict.ok).toBe(false);
  expect(verdict.report).toContain("main protection has drifted:");
  expect(verdict.report).toContain('drift: the "gate" check is not required');
  expect(verdict.report).toContain("drift: enforce_admins=false, want true");
});

test("a mocked admin-PAT protection response compares clean: parse -> drift -> green verdict", () => {
  // The shape the admin-scope `gh api .../branches/main/protection` returns when main is locked down — the
  // CI step walks exactly this path once VOW_ADMIN_TOKEN is provisioned.
  const live = JSON.stringify({
    enforce_admins: { enabled: true },
    required_pull_request_reviews: { required_approving_review_count: 0 },
    required_status_checks: { contexts: ["gate"], strict: false },
  });
  const verdict = driftReport(protectionDrift(parseProtection(live), MAIN_PROTECTION));
  expect(verdict.ok).toBe(true);
});

test("a mocked loosened protection response compares to a failing verdict naming every drift", () => {
  // A main that silently lost enforce_admins + the gate check + gained a human review — the CI gate fails.
  const live = JSON.stringify({
    enforce_admins: { enabled: false },
    required_pull_request_reviews: { required_approving_review_count: 1 },
    required_status_checks: { contexts: [], strict: false },
  });
  const verdict = driftReport(protectionDrift(parseProtection(live), MAIN_PROTECTION));
  expect(verdict.ok).toBe(false);
  expect(verdict.report).toContain('the "gate" check is not required');
  expect(verdict.report).toContain("enforce_admins=false, want true");
  expect(verdict.report).toContain("required reviews=1, want 0");
});
