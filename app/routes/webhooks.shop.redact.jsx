import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  try {
    await authenticate.webhook(request);
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Failed to process SHOP_REDACT webhook", error);
    return new Response("Unauthorized", { status: 401 });
  }
};
