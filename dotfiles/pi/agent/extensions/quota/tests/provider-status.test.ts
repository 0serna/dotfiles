import { describe, expect, it } from "vitest";
import { formatProviderStatus } from "../status.js";
import { makeContext } from "./helpers.js";

describe("formatProviderStatus", () => {
  const ctx = makeContext();

  it("formats provider errors with label", () => {
    expect(
      formatProviderStatus("Codex", "fetch_failed", {}, () => "ok", ctx),
    ).toBe("<warning>Codex error</warning>");
    expect(formatProviderStatus("OpenCode", null, null, () => "ok", ctx)).toBe(
      "<warning>OpenCode error</warning>",
    );
  });

  it("formats successful provider status with label", () => {
    expect(formatProviderStatus("Codex", null, {}, () => "ok", ctx)).toBe(
      "<dim>Codex </dim>ok",
    );
    expect(formatProviderStatus("OpenCode", null, {}, () => "ok", ctx)).toBe(
      "<dim>OpenCode </dim>ok",
    );
  });
});
