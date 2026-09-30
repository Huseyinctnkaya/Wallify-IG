import { handleTrackingRequest } from "../utils/tracking.server";

// Resource route behind the App Proxy (see [app_proxy] in shopify.app.toml).
// It renders no UI, so every branch returns a real Response.

export const action = async ({ request }) => {
  return handleTrackingRequest(request);
};

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("type")) {
    return handleTrackingRequest(request);
  }

  // Reachable without a signature: a fixed string used to confirm the proxy is
  // wired up. It exposes no shop data.
  return Response.json({ message: "Tracking API is active" });
};
