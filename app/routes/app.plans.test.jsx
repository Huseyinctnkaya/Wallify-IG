import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppProvider } from "@shopify/polaris";
import translations from "@shopify/polaris/locales/en.json";

const EMBEDDED_SEARCH =
  "?embedded=1&host=YWRtaW4uc2hvcGlmeS5jb20&shop=demo.myshopify.com";

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useLoaderData: () => ({ isPremium: false, billingError: null }),
  useLocation: () => ({ search: EMBEDDED_SEARCH }),
  useFetcher: () => ({ submit: vi.fn(), state: "idle", data: null }),
}));
vi.mock("../shopify.server", () => ({
  authenticate: { admin: vi.fn() },
  PREMIUM_PLAN: "Premium",
}));
vi.mock("../utils/premium.server", () => ({ isPremiumShop: vi.fn() }));

const Plans = (await import("./app.plans")).default;

const html = renderToStaticMarkup(
  <AppProvider i18n={translations}>
    <Plans />
  </AppProvider>,
);

/** The href as a browser would follow it, with HTML entities decoded. */
function subscribeHref() {
  const match = html.match(/href="([^"]*plans\/subscribe[^"]*)"/);
  return match ? match[1].replaceAll("&amp;", "&") : null;
}

describe("plans page", () => {
  it("keeps the embedded params on the upgrade link", () => {
    // The SDK decides how to leave the iframe by reading embedded=1 and host
    // off the request URL. Drop them and it takes the non-embedded branch,
    // returning a redirect the iframe cannot follow — the charge screen never
    // opens and the route renders a bare status code instead.
    expect(subscribeHref()).toBe(`/app/plans/subscribe${EMBEDDED_SEARCH}`);
  });

  it("does not link to the bare subscribe path", () => {
    expect(subscribeHref()).not.toBe("/app/plans/subscribe");
  });
});
