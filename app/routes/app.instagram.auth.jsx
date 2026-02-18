import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { buildInstagramAuthUrl } from "../utils/instagram-oauth.server";

export const loader = async ({ request }) => {
    const requestUrl = new URL(request.url);
    let shop = requestUrl.searchParams.get("shop");

    if (!shop) {
        try {
            const { session } = await authenticate.admin(request);
            shop = session?.shop || null;
        } catch (error) {
            console.error("Instagram auth shop resolve failed:", error);
        }
    }

    if (!shop) {
        return redirect("/auth/login");
    }

    try {
        const authUrl = buildInstagramAuthUrl({ shop });
        return redirect(authUrl);
    } catch (error) {
        console.error("Instagram auth start failed:", error);
        return redirect("/app?ig_connect=error");
    }
};

export default function InstagramAuthRoute() {
    return null;
}
