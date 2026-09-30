import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppProvider } from "@shopify/polaris";
import translations from "@shopify/polaris/locales/en.json";

vi.mock("../shopify.server", () => ({ authenticate: { admin: vi.fn() } }));

const Contact = (await import("./app.contact")).default;

const html = renderToStaticMarkup(
  <AppProvider i18n={translations}>
    <Contact />
  </AppProvider>,
);

describe("contact page", () => {
  it("renders without throwing", () => {
    expect(html.length).toBeGreaterThan(500);
  });

  it("shows the support email and website", () => {
    expect(html).toContain("info@34devs.com");
    expect(html).toContain("landing.wallifyig.app");
  });

  it("marks each question as a collapsed disclosure for screen readers", () => {
    // The previous version wrapped a heading in a button with no aria state,
    // so assistive tech could not tell an answer was hidden.
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("aria-controls=");
  });

  it("does not point merchants at a Settings page that does not exist", () => {
    // The app has no Settings route; customisation lives on the Dashboard.
    expect(html).not.toContain("Go to Settings");
  });

  it("boxes each icon so it cannot absorb the row's free space", () => {
    // .Polaris-Icon sets `margin: auto`. Left as a bare flex child of the row
    // it eats all the slack and throws the text to the opposite edge, with the
    // icon landing in a different spot on every row. A fixed-width wrapper
    // gives the auto margins nothing to take.
    const rows = [...html.matchAll(/<div class="Polaris-InlineStack"[^>]*>(.*?)<\/div><\/div>/gs)];
    expect(rows.length).toBeGreaterThan(0);
    for (const [row] of rows) {
      const iconAt = row.indexOf("Polaris-Icon");
      if (iconAt === -1) continue;
      expect(row.slice(0, iconAt)).toMatch(/min-width:\s*1\.25rem|width:\s*1\.25rem/);
    }
  });

  it("uses Polaris icons rather than emoji glyphs", () => {
    for (const emoji of ["📧", "⏰", "🌐"]) {
      expect(html).not.toContain(emoji);
    }
    expect(html).toContain("Polaris-Icon");
  });

  it("leaves colours to Polaris instead of hardcoding hex values", () => {
    expect(html).not.toContain("#f0f0f0");
    expect(html).not.toContain("#005bd3");
  });
});
