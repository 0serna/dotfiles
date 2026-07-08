import { describe, expect, it } from "vitest";
import { formatProviderStatus } from "../status.js";
import { makeContext } from "./helpers.js";

describe("formatProviderStatus", () => {
  const ctx = makeContext();

  it("formats provider errors with label", () => {
    expect(
      formatProviderStatus("Codex", "fetch_failed", {}, () => "ok", ctx),
    ).toBe("<warning>Codex error</warning>");
    expect(formatProviderStatus("OC", null, null, () => "ok", ctx)).toBe(
      "<warning>OC error</warning>",
    );
  });

  it("formats successful provider status with label", () => {
    expect(formatProviderStatus("Codex", null, {}, () => "ok", ctx)).toBe(
      "<dim>Codex </dim>ok",
    );
    expect(formatProviderStatus("OC", null, {}, () => "ok", ctx)).toBe(
      "<dim>OC </dim>ok",
    );
  });
});
