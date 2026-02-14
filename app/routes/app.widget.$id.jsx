import { json, redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getWidget, updateWidget, publishWidget } from "../models/widget.server";
import { getInstagramAccount } from "../models/instagram.server";

export async function loader({ request, params }) {
    const { session, admin } = await authenticate.admin(request);
    const widgetId = params.id;

    const widget = await getWidget(widgetId);
    if (!widget) return json({ error: "Widget not found" }, { status: 404 });

    const account = await getInstagramAccount(session.shop);
    let media = [];

    if (account && account.accessToken) {
        try {
            const { fetchInstagramMedia } = await import("../models/instagram.server");
            media = await fetchInstagramMedia(account.accessToken);
        } catch (e) {
            console.error("Preview media fetch error", e);
        }
    }

    return json({ widget, media, account });
}

export async function action({ request, params }) {
    const { session, admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const actionType = formData.get("actionType");
    const widgetId = params.id;

    if (actionType === "save" || actionType === "publish") {
        const configuration = formData.get("configuration");

        const configObj = JSON.parse(configuration);

        const updatedWidget = await updateWidget(widgetId, {
            title: configObj.title,
            configuration: configuration
        });

        if (actionType === "publish") {
            await publishWidget(admin, updatedWidget);
            return json({ success: true, message: "Widget published to storefront!", actionType });
        }

        return json({ success: true, message: "Changes saved (Draft)", actionType });
    }

    return null;
}
