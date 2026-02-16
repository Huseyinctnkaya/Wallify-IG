import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { trackMetric } from "../models/analytics.server";

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
  try {
    const { session } = await authenticate.public.appProxy(request);
    const url = new URL(request.url);
    const shop = session?.shop || url.searchParams.get("shop");

    if (!shop) {
      console.error("Tracking API: Unauthorized App Proxy request");
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, mediaId, mediaUrl, permalink } = await extractTrackingPayload(request);

    if (!type) {
      return json({ error: "Invalid type" }, { status: 400 });
    }

    console.info("[tracking-proxy]", { shop, type, mediaId });
    await trackMetric(shop, type, { mediaId, mediaUrl, permalink });

    return json({ success: true });
  } catch (error) {
    console.error("Tracking API Error:", error);
    return json({ error: error.message }, { status: 500 });
  }
}
