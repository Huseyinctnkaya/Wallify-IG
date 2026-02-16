import { json } from "@remix-run/node";
import { trackMetric } from "../models/analytics.server";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function isValidShopDomain(shop) {
  return typeof shop === "string" && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}

function parseFromQuery(request) {
  const url = new URL(request.url);
  return {
    shop: url.searchParams.get("shop"),
    type: url.searchParams.get("type"),
    mediaId: url.searchParams.get("mediaId"),
    mediaUrl: url.searchParams.get("mediaUrl"),
    permalink: url.searchParams.get("permalink"),
  };
}

async function parsePayload(request) {
  const fromQuery = parseFromQuery(request);
  if (request.method === "GET") return fromQuery;

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const body = await request.json();
      return {
        shop: body?.shop || fromQuery.shop,
        type: body?.type || fromQuery.type,
        mediaId: body?.mediaId || fromQuery.mediaId,
        mediaUrl: body?.mediaUrl || fromQuery.mediaUrl,
        permalink: body?.permalink || fromQuery.permalink,
      };
    } catch {
      return fromQuery;
    }
  }

  try {
    const formData = await request.formData();
    return {
      shop: formData.get("shop") || fromQuery.shop,
      type: formData.get("type") || fromQuery.type,
      mediaId: formData.get("mediaId") || fromQuery.mediaId,
      mediaUrl: formData.get("mediaUrl") || fromQuery.mediaUrl,
      permalink: formData.get("permalink") || fromQuery.permalink,
    };
  } catch {
    return fromQuery;
  }
}

async function handle(request) {
  const payload = await parsePayload(request);
  const { shop, type, mediaId, mediaUrl, permalink } = payload;

  if (!isValidShopDomain(shop)) {
    return json({ error: "Invalid shop" }, { status: 400, headers: corsHeaders() });
  }

  if (!type) {
    return json({ error: "Invalid type" }, { status: 400, headers: corsHeaders() });
  }

  console.info("[tracking-direct]", { shop, type, mediaId });
  await trackMetric(shop, type, { mediaId, mediaUrl, permalink });
  return json({ success: true }, { headers: corsHeaders() });
}

export const loader = async ({ request }) => {
  return handle(request);
};

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  return handle(request);
};
