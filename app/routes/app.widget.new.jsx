import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { createWidget } from "../models/widget.server";

export async function loader({ request }) {
    const { session } = await authenticate.admin(request);
    const widget = await createWidget(session.shop);
    return redirect(`/app/widget/${widget.id}`);
}
