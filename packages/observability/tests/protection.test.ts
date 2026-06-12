import {
  MAIN_PROTECTION,
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
  expect(protectionDrift(loose, MAIN_PROTECTION).length).toBeGreaterThan(0);
  const tight = { checks: ["gate"], enforceAdmins: true, requirePr: true, reviews: 0 };
  expect(protectionDrift(tight, MAIN_PROTECTION)).toEqual([]);
});
