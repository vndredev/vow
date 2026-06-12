import {
  BUTTON_CONTEXT_DEFAULTS,
  BUTTON_INTENTS,
  CONTROL_SIZES,
  STATUS_INTENTS,
  TONES,
  VARIANTS,
  buttonContextDefault,
  resolveButton,
  resolveStatus,
} from "../src/design.ts";
import { expect, test } from "vite-plus/test";

/**
 * The design language, pinned. Every intent must resolve to tokens that exist in the vocabulary (so an
 * intent can never name a variant/tone/size the theme has no rule for), and the spec's concrete mappings
 * (design.md) are asserted exactly — so a drift in the resolution map fails here, not in a rendered UI.
 */

test("every button intent resolves to a valid variant · tone · size", () => {
  for (const tokens of Object.values(BUTTON_INTENTS)) {
    expect(VARIANTS).toContain(tokens.variant);
    expect(TONES).toContain(tokens.tone);
    expect(CONTROL_SIZES).toContain(tokens.size);
  }
});

test("every status intent resolves to a valid variant · tone", () => {
  for (const tokens of Object.values(STATUS_INTENTS)) {
    expect(VARIANTS).toContain(tokens.variant);
    expect(TONES).toContain(tokens.tone);
  }
});

test("every context default points at a real button intent", () => {
  for (const fallback of Object.values(BUTTON_CONTEXT_DEFAULTS)) {
    expect(BUTTON_INTENTS).toHaveProperty(fallback.lead);
    expect(BUTTON_INTENTS).toHaveProperty(fallback.rest);
  }
});

test("the resolvers return the spec's tokens (the language is pinned, not just valid)", () => {
  expect(resolveButton("primary")).toEqual({ size: "md", tone: "accent", variant: "solid" });
  expect(resolveButton("destructive")).toEqual({ size: "md", tone: "danger", variant: "outline" });
  expect(resolveButton("row")).toEqual({ size: "sm", tone: "neutral", variant: "ghost" });
  expect(resolveStatus("done")).toEqual({ tone: "success", variant: "soft" });
  expect(resolveStatus("blocked")).toEqual({ tone: "danger", variant: "soft" });
});

test("a context resolves to its lead intent (the zero-ceremony default)", () => {
  expect(buttonContextDefault("row")).toBe("row");
  expect(buttonContextDefault("form-footer")).toBe("primary");
  expect(buttonContextDefault("dialog-footer")).toBe("primary");
  expect(buttonContextDefault("toolbar")).toBe("toolbar");
});
