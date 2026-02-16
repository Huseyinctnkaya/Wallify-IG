import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { trackMetric } from "../models/analytics.server";

export const action = async ({ request }) => {
    try {
        const { session } = await authenticate.public.appProxy(request);
        const shop = session?.shop;

        if (!shop) {
            console.error("Tracking API: Unauthorized App Proxy request");
            return json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { type, mediaId, mediaUrl, permalink } = body;

        if (!type) {
            return json({ error: "Invalid type" }, { status: 400 });
        }

        await trackMetric(shop, type, { mediaId, mediaUrl, permalink });

        return json({ success: true });
    } catch (error) {
        console.error("Tracking API Error:", error);
        return json({ error: error.message }, { status: 500 });
    }
};

// Allow GET for testing or simple view tracking
export const loader = async () => {
    return json({ message: "Tracking API is active" });
};
