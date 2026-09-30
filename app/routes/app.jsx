import { Link, Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  // Two providers, because they do different jobs.
  //
  // The Shopify one sets up App Bridge and wires its navigation events into
  // the router. Unlike its shopify-app-remix predecessor it does NOT wrap
  // Polaris React -- the React Router SDK assumes Polaris web components, and
  // only loads their script. This app's screens are built from Polaris React
  // components, whose Page header calls useI18n, so without the Polaris
  // provider below every admin route fails to render with
  // MissingAppProviderError.
  return (
    <AppProvider apiKey={apiKey}>
      <PolarisAppProvider i18n={polarisTranslations}>
        <NavMenu>
          <Link to="/app" rel="home">
            Wallify IG ‑ Instagram Feed
          </Link>
          <Link to="/app/posts">Posts & Reels</Link>
          <Link to="/app/analytics">Analytics</Link>
          <Link to="/app/plans">Plans</Link>
          <Link to="/app/contact">Contact</Link>
        </NavMenu>
        <Outlet />
      </PolarisAppProvider>
    </AppProvider>
  );
}

// Shopify needs the framework to catch some thrown responses, so that their
// headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
