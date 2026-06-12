import { describe, it, expect } from "vitest";
import {
  BUTTON_INTENTS,
  BADGE_INTENTS,
  VARIANTS,
  TONES,
  SIZES,
  DENSITIES,
  type ButtonIntent,
  type BadgeIntent,
} from "./vocab";

describe("design language resolution", () => {
  describe("button intents", () => {
    it("every button intent resolves to valid tokens", () => {
      (Object.entries(BUTTON_INTENTS) as [ButtonIntent, (typeof BUTTON_INTENTS)[ButtonIntent]][]).forEach(
        ([intent, resolution]) => {
          // Variant is always present
          expect(VARIANTS).toContain(resolution.variant);
          // Tone is always present
          expect(TONES).toContain(resolution.tone);
          // Size is always present
          expect(SIZES).toContain(resolution.size);
          // Density is optional but valid if present
          if (resolution.density !== undefined) {
            expect(DENSITIES).toContain(resolution.density);
          }
        }
      );
    });

    it("has at least the required intents", () => {
      const required = ["primary", "secondary", "subtle", "row", "toolbar", "destructive"];
      required.forEach((intent) => {
        expect(Object.keys(BUTTON_INTENTS)).toContain(intent);
      });
    });
  });

  describe("badge intents", () => {
    it("every badge intent resolves to valid tokens", () => {
      (Object.entries(BADGE_INTENTS) as [BadgeIntent, (typeof BADGE_INTENTS)[BadgeIntent]][]).forEach(
        ([intent, resolution]) => {
          // Variant is always present
          expect(VARIANTS).toContain(resolution.variant);
          // Tone is always present
          expect(TONES).toContain(resolution.tone);
        }
      );
    });

    it("has at least the required intents", () => {
      const required = ["planned", "doing", "done", "blocked", "at-risk"];
      required.forEach((intent) => {
        expect(Object.keys(BADGE_INTENTS)).toContain(intent);
      });
    });
  });

  describe("token vocabularies", () => {
    it("variants are orthogonal and complete", () => {
      expect(VARIANTS).toEqual(["solid", "soft", "outline", "ghost", "link"]);
    });

    it("tones are orthogonal and complete", () => {
      expect(TONES).toEqual(["neutral", "accent", "success", "warning", "danger", "info"]);
    });

    it("sizes are orthogonal and complete", () => {
      expect(SIZES).toEqual(["xs", "sm", "md", "lg", "xl"]);
    });

    it("densities are orthogonal and complete", () => {
      expect(DENSITIES).toEqual(["comfortable", "compact"]);
    });
  });
});
