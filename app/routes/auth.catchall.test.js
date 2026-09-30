import { describe, expect, it, vi } from "vitest";

const adminAuth = vi.fn();
vi.mock("../shopify.server", () => ({ authenticate: { admin: (...a) => adminAuth(...a) } }));

const { loader } = await import("./auth.$");

/** Run the loader and report whether it returned or threw, without rethrowing. */
async function run() {
  try {
    return { returned: await loader({ request: new Request("https://app.example/auth/exit-iframe") }) };
  } catch (thrown) {
    return { thrown };
  }
}

describe("auth catch-all route", () => {
  it("returns the App Bridge page instead of letting it throw", async () => {
    // The SDK throws a 200 carrying the script that moves the top window to
    // Shopify's charge screen. React Router forwards thrown *redirects* only;
    // any other thrown Response becomes an ErrorResponse and the boundary
    // renders bare status text, so the browser shows "200" and the script
    // never runs.
    const page = new Response("<script>window.open('https://shop/admin/charges/1','_top')</script>", {
      headers: { "content-type": "text/html" },
    });
    adminAuth.mockRejectedValue(page);

    const { returned, thrown } = await run();

    expect(thrown).toBeUndefined();
    expect(returned).toBe(page);
    expect(await returned.text()).toContain("window.open");
  });

  it("returns redirects rather than swallowing them", async () => {
    const redirect = new Response(null, { status: 302, headers: { location: "/app" } });
    adminAuth.mockRejectedValue(redirect);

    const { returned } = await run();

    expect(returned).toBe(redirect);
  });

  it("still lets real errors propagate", async () => {
    adminAuth.mockRejectedValue(new Error("token exchange failed"));

    const { thrown } = await run();

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).toBe("token exchange failed");
  });

  it("returns null when authentication simply succeeds", async () => {
    adminAuth.mockResolvedValue({ session: {} });

    const { returned } = await run();

    expect(returned).toBeNull();
  });
});
