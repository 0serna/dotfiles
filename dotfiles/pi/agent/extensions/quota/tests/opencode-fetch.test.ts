import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionLogger } from "../../shared/logger.js";
import { fetchOpenCodeGoData } from "../opencode.js";

describe("fetchOpenCodeGoData logging", () => {
  const events: Array<{ event: string; data?: Record<string, unknown> }> = [];
  const logger: ExtensionLogger = {
    log(event, data) {
      events.push({ event, data });
    },
  };

  beforeEach(() => {
    events.length = 0;
    vi.stubEnv("OC_GO_WORKSPACE_1", "workspace-1");
    vi.stubEnv("OC_GO_COOKIE_1", "cookie-1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("includes the account name in successful fetch logs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(dashboardHtml())),
    );

    await fetchOpenCodeGoData(
      "1",
      "OC_GO_WORKSPACE_1",
      "OC_GO_COOKIE_1",
      logger,
    );

    expect(events).toContainEqual({
      event: "go_fetch_succeeded",
      data: expect.objectContaining({ account: "1" }),
    });
    expectEveryFetchEventHasAccount(events);
  });

  it("includes the account name in HTTP failure logs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 429 })),
    );

    await fetchOpenCodeGoData(
      "1",
      "OC_GO_WORKSPACE_1",
      "OC_GO_COOKIE_1",
      logger,
    );

    expect(events.filter(({ event }) => event.startsWith("go_fetch_"))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "go_fetch_failed",
          data: expect.objectContaining({ account: "1" }),
        }),
      ]),
    );
    expectEveryFetchEventHasAccount(events);
  });

  it("includes the account name in exception logs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await fetchOpenCodeGoData(
      "1",
      "OC_GO_WORKSPACE_1",
      "OC_GO_COOKIE_1",
      logger,
    );

    expect(events.filter(({ event }) => event.startsWith("go_fetch_"))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "go_fetch_error",
          data: expect.objectContaining({ account: "1" }),
        }),
        expect.objectContaining({
          event: "go_fetch_failed",
          data: expect.objectContaining({ account: "1" }),
        }),
      ]),
    );
    expectEveryFetchEventHasAccount(events);
  });
});

function expectEveryFetchEventHasAccount(
  events: ReadonlyArray<{ event: string; data?: Record<string, unknown> }>,
): void {
  const fetchEvents = events.filter(({ event }) =>
    event.startsWith("go_fetch_"),
  );
  expect(fetchEvents.length).toBeGreaterThan(0);
  expect(fetchEvents.every(({ data }) => data?.account === "1")).toBe(true);
}

function dashboardHtml(): string {
  return `<script>rollingUsage:$R[0]={usagePercent:0,resetInSec:10};weeklyUsage:$R[1]={usagePercent:10,resetInSec:20};monthlyUsage:$R[2]={usagePercent:20,resetInSec:30};balance:100000000;</script>`;
}
