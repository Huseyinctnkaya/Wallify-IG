import { afterEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const postUpsert = vi.fn();

vi.mock("../db.server", () => ({
  prisma: {
    analytics: { upsert: (...args) => upsert(...args) },
    postAnalytics: { upsert: (...args) => postUpsert(...args) },
  },
}));

const { trackMetric } = await import("./analytics.server");

// 18:00 UTC is already the next calendar day in this suite's TZ (UTC+14), so a
// local-time implementation and a UTC one disagree about which day it is.
const AMBIGUOUS_INSTANT = new Date("2026-03-15T18:00:00Z");

afterEach(() => {
  vi.useRealTimers();
  upsert.mockReset();
  postUpsert.mockReset();
});

describe("trackMetric day bucketing", () => {
  it("buckets by the UTC day, not the server's local day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AMBIGUOUS_INSTANT);

    await trackMetric("demo.myshopify.com", "view");

    const { where, create } = upsert.mock.calls[0][0];
    // Local midnight here would be 2026-03-15T10:00:00Z, which is what the
    // previous implementation wrote.
    expect(where.shop_date.date.toISOString()).toBe("2026-03-15T00:00:00.000Z");
    expect(create.date.toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });

  it("puts two events on opposite sides of UTC midnight in different buckets", async () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-03-15T23:59:00Z"));
    await trackMetric("demo.myshopify.com", "view");

    vi.setSystemTime(new Date("2026-03-16T00:01:00Z"));
    await trackMetric("demo.myshopify.com", "view");

    const days = upsert.mock.calls.map((c) => c[0].where.shop_date.date.toISOString());
    expect(days).toEqual(["2026-03-15T00:00:00.000Z", "2026-03-16T00:00:00.000Z"]);
  });

  it("increments only the counter matching the event type", async () => {
    await trackMetric("demo.myshopify.com", "click");

    const { update, create } = upsert.mock.calls[0][0];
    expect(update.clicks).toEqual({ increment: 1 });
    expect(update.views).toBeUndefined();
    expect(create).toMatchObject({ views: 0, clicks: 1 });
  });
});

describe("trackMetric per-post rows", () => {
  it("skips the per-post write when there is no mediaId", async () => {
    await trackMetric("demo.myshopify.com", "view");
    expect(postUpsert).not.toHaveBeenCalled();
  });

  it("records the post and carries media metadata through", async () => {
    await trackMetric("demo.myshopify.com", "click", {
      mediaId: "17900000000000000",
      mediaUrl: "https://cdn.example/a.jpg",
      permalink: "https://instagram.com/p/abc",
    });

    expect(postUpsert).toHaveBeenCalledOnce();
    const { where, create } = postUpsert.mock.calls[0][0];
    expect(where.shop_mediaId).toEqual({
      shop: "demo.myshopify.com",
      mediaId: "17900000000000000",
    });
    expect(create).toMatchObject({ clicks: 1, views: 0 });
  });

  it("leaves stored media metadata alone when an event omits it", async () => {
    await trackMetric("demo.myshopify.com", "view", { mediaId: "123" });

    const { update } = postUpsert.mock.calls[0][0];
    // `undefined` tells Prisma not to touch the column, so a later event
    // without a permalink cannot blank out one recorded earlier.
    expect(update.mediaUrl).toBeUndefined();
    expect(update.permalink).toBeUndefined();
  });
});
