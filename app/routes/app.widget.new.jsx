import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { createWidget } from "../models/widget.server";

export async function loader({ request }) {
    return json({ error: "Method not allowed" }, { status: 405 });
}

export async function action({ request }) {
    const { session } = await authenticate.admin(request);
    const widget = await createWidget(session.shop);
    return json({ widget });
}
