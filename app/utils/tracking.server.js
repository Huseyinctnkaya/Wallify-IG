import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { trackMetric } from "../models/analytics.server";

const VALID_METRIC_TYPES = new Set(["view", "click"]);
const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

// Instagram media IDs are numeric; permalinks and media URLs are Instagram CDN
// URLs. Cap them so a malformed storefront payload cannot write unbounded rows.
const MAX_ID_LENGTH = 64;
const MAX_URL_LENGTH = 2048;

function clamp(value, maxLength) {
  if (typeof value !== "string" || value === "") return null;
  return value.length > maxLength ? null : value;
}

async function extractTrackingPayload(request) {
  const url = new URL(request.url);
  const queryPayload = {
    type: url.searchParams.get("type"),
    mediaId: url.searchParams.get("mediaId"),
    mediaUrl: url.searchParams.get("mediaUrl"),
    permalink: url.searchParams.get("permalink"),
  };

  if (request.method === "GET") {
    return queryPayload;
  }

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const body = await request.json();
      return {
        type: body?.type || queryPayload.type,
        mediaId: body?.mediaId || queryPayload.mediaId,
        mediaUrl: body?.mediaUrl || queryPayload.mediaUrl,
        permalink: body?.permalink || queryPayload.permalink,
      };
    } catch {
      return queryPayload;
    }
  }

  try {
    const formData = await request.formData();
    return {
      type: formData.get("type") || queryPayload.type,
      mediaId: formData.get("mediaId") || queryPayload.mediaId,
      mediaUrl: formData.get("mediaUrl") || queryPayload.mediaUrl,
      permalink: formData.get("permalink") || queryPayload.permalink,
    };
  } catch {
    return queryPayload;
  }
}

export async function handleTrackingRequest(request) {
  let session;
  let signedShop;

  try {
    // Shopify signs every request it forwards through the App Proxy. This call
    // verifies that HMAC and throws a 401 Response if it does not match, which
    // is the only thing establishing that the caller is a real storefront
    // session for this shop. Do not add an unsigned path around it.
    ({ session } = await authenticate.public.appProxy(request));
    signedShop = new URL(request.url).searchParams.get("shop");
  } catch (error) {
    // appProxy signals auth failure by throwing a Response - let it through
    // untouched so the caller gets the correct status instead of a 500.
    if (error instanceof Response) throw error;
    console.error("App Proxy authentication failed:", error);
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  // `session` is undefined when no offline session exists for the shop. The
  // `shop` query param is safe to fall back on *only* because it is part of the
  // payload the signature above already covered.
  const shop = session?.shop || signedShop;

  if (!SHOP_DOMAIN_PATTERN.test(shop ?? "")) {
    console.error("Tracking API: could not resolve shop from signed request");
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await extractTrackingPayload(request);

  if (!VALID_METRIC_TYPES.has(payload.type)) {
    return json({ error: "Invalid type" }, { status: 400 });
  }

  try {
    await trackMetric(shop, payload.type, {
      mediaId: clamp(payload.mediaId, MAX_ID_LENGTH),
      mediaUrl: clamp(payload.mediaUrl, MAX_URL_LENGTH),
      permalink: clamp(payload.permalink, MAX_URL_LENGTH),
    });
  } catch (error) {
    // Never leak internals to the storefront.
    console.error("Tracking write failed:", { shop, type: payload.type, error });
    return json({ error: "Could not record event" }, { status: 500 });
  }

  return json({ success: true });
}
