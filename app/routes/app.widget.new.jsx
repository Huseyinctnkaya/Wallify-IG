import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { createWidget } from "../models/widget.server";

export async function loader({ request }) {
    // If user accesses directly, redirect to dashboard or handle as action
    // But since it's a mutation, we prefer action.
    // However, if we redirect here, the previous page which triggered it via GET (window.location)
    // might still cause a refresh loop.
    // Let's redirect to dashboard if hit via GET.
    return redirect("/app");
}

export async function action({ request }) {
    const { session } = await authenticate.admin(request);
    const widget = await createWidget(session.shop);
    return redirect(`/app/widget/${widget.id}`);
}
