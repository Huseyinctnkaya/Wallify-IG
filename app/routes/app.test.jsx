import { describe, expect, it, vi } from "vitest";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useLoaderData: () => ({ apiKey: "test-key" }),
}));
vi.mock("../shopify.server", () => ({ authenticate: { admin: vi.fn() } }));
vi.mock("@shopify/app-bridge-react", () => ({ NavMenu: ({ children }) => children }));

const AppRoute = (await import("./app")).default;

/** Every component type in a React element tree, depth first. */
function componentTypes(node, found = []) {
  if (!node || typeof node !== "object") return found;
  if (Array.isArray(node)) {
    node.forEach((child) => componentTypes(child, found));
    return found;
  }
  if (node.type) found.push(node.type);
  componentTypes(node.props?.children, found);
  return found;
}

describe("admin route shell", () => {
  // Asserted structurally rather than by rendering. createRoutesStub defers to
  // client hydration and server-renders to an empty string, and rendering the
  // tree directly trips the dual-package hazard: this file resolves
  // react-router's CJS build while the Shopify SDK resolves its ESM one, so
  // the two see different Router contexts and useNavigate throws.
  it("provides Polaris i18n to the admin screens", () => {
    // The Shopify SDK's AppProvider does not wrap Polaris React -- the React
    // Router SDK assumes Polaris web components and only loads their script.
    // Without this route supplying its own Polaris provider, every Polaris
    // Page header calls useI18n with no provider and throws
    // MissingAppProviderError, which is a 500 on every admin route.
    const types = componentTypes(AppRoute());

    expect(types).toContain(PolarisAppProvider);
  });

  it("gives that provider a translation bundle", () => {
    const provider = findProvider(AppRoute());

    expect(provider).toBeTruthy();
    // Polaris reads i18n eagerly in useI18n; an empty bundle throws just the
    // same as a missing provider.
    expect(provider.props.i18n).toBeTruthy();
    expect(Object.keys(provider.props.i18n).length).toBeGreaterThan(0);
  });
});

function findProvider(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findProvider(child);
      if (hit) return hit;
    }
    return null;
  }
  if (node.type === PolarisAppProvider) return node;
  return findProvider(node.props?.children);
}
