import { afterEach, describe, expect, it, vi } from "vitest";

const appProxy = vi.fn();
const trackMetric = vi.fn();

vi.mock("../shopify.server", () => ({
  authenticate: { public: { appProxy: (...args) => appProxy(...args) } },
}));
vi.mock("../models/analytics.server", () => ({
  trackMetric: (...args) => trackMetric(...args),
}));

const { handleTrackingRequest } = await import("./tracking.server");

const SHOP = "demo.myshopify.com";

function proxyRequest(body, { shop = SHOP } = {}) {
  const url = new URL("https://app.example/api");
  if (shop) url.searchParams.set("shop", shop);
  // Shopify appends these when it forwards a storefront request; the signature
  // is what authenticate.public.appProxy verifies.
  url.searchParams.set("signature", "stub");
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  appProxy.mockReset();
  trackMetric.mockReset();
});

describe("App Proxy signature boundary", () => {
  it("passes through the status appProxy throws instead of masking it as 500", async () => {
    // A missing signature makes appProxy throw a 400 Response; an invalid one a
    // 401. Both must survive: the previous implementation caught the Response
    // and reported 500 for everything.
    appProxy.mockRejectedValue(new Response("no signature", { status: 400 }));

    await expect(handleTrackingRequest(proxyRequest({ type: "view" })))
      .rejects.toMatchObject({ status: 400 });
    expect(trackMetric).not.toHaveBeenCalled();
  });

  it("rejects with 401 when appProxy fails for a non-Response reason", async () => {
    appProxy.mockRejectedValue(new Error("boom"));

    const response = await handleTrackingRequest(proxyRequest({ type: "view" }));

    expect(response.status).toBe(401);
    expect(trackMetric).not.toHaveBeenCalled();
  });

  it("refuses a signed request whose shop is not a myshopify domain", async () => {
    appProxy.mockResolvedValue({ session: undefined });

    const response = await handleTrackingRequest(
      proxyRequest({ type: "view" }, { shop: "evil.example.com" }),
    );

    expect(response.status).toBe(401);
    expect(trackMetric).not.toHaveBeenCalled();
  });

  it("prefers the session shop over the query parameter", async () => {
    appProxy.mockResolvedValue({ session: { shop: "real.myshopify.com" } });

    await handleTrackingRequest(
      proxyRequest({ type: "view" }, { shop: "other.myshopify.com" }),
    );

    expect(trackMetric).toHaveBeenCalledWith("real.myshopify.com", "view", expect.anything());
  });

  it("falls back to the signed shop param when there is no offline session", async () => {
    appProxy.mockResolvedValue({ session: undefined });

    await handleTrackingRequest(proxyRequest({ type: "click" }));

    expect(trackMetric).toHaveBeenCalledWith(SHOP, "click", expect.anything());
  });
});

describe("payload validation", () => {
  it.each(["", "banana", "VIEW", undefined])(
    "rejects metric type %o with 400",
    async (type) => {
      appProxy.mockResolvedValue({ session: { shop: SHOP } });

      const response = await handleTrackingRequest(proxyRequest({ type }));

      expect(response.status).toBe(400);
      expect(trackMetric).not.toHaveBeenCalled();
    },
  );

  it("drops oversized media fields rather than storing them", async () => {
    appProxy.mockResolvedValue({ session: { shop: SHOP } });

    await handleTrackingRequest(
      proxyRequest({
        type: "view",
        mediaId: "1".repeat(200),
        permalink: `https://instagram.com/${"a".repeat(3000)}`,
      }),
    );

    expect(trackMetric).toHaveBeenCalledWith(SHOP, "view", {
      mediaId: null,
      mediaUrl: null,
      permalink: null,
    });
  });

  it("does not leak the underlying error when the write fails", async () => {
    appProxy.mockResolvedValue({ session: { shop: SHOP } });
    trackMetric.mockRejectedValue(new Error("connection string: postgres://user:secret@host"));

    const response = await handleTrackingRequest(proxyRequest({ type: "view" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});
