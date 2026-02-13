import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { exchangeCodeForToken, exchangeShortTokenForLong, saveInstagramAccount } from "../models/instagram.server";

export async function loader({ request }) {
    const { session } = await authenticate.admin(request);
    const { shop } = session;

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const errorReason = url.searchParams.get("error_reason");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
        console.error("Instagram Auth Error:", errorReason, errorDescription);
        return redirect("/app?error=" + encodeURIComponent(errorDescription || "Authorization failed"));
    }

    if (!code) {
        return redirect("/app?error=No code returned");
    }

    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
    const appUrl = process.env.SHOPIFY_APP_URL;

    if (!clientId || !clientSecret || !appUrl) {
        console.error("Missing ENV variables for Instagram");
        return redirect("/app?error=Server misconfiguration");
    }

    const redirectUri = `${appUrl}/app/instagram/callback`;

    try {
        // 1. Exchange Code for Short-lived Token
        const shortData = await exchangeCodeForToken(code, redirectUri, clientId, clientSecret);
        // shortData: { access_token, user_id }

        // 2. Exchange Short-lived for Long-lived (60 days)
        const longData = await exchangeShortTokenForLong(shortData.access_token, clientSecret);
        // longData: { access_token, expires_in, token_type }

        // 3. Save to DB
        // Business Login tokens often wrap the user ID differently or we might need to fetch 'me' first. 
        // Our updated 'saveInstagramAccount' handles fetching details if username is missing.
        await saveInstagramAccount({
            shop,
            accessToken: longData.access_token,
            userId: shortData.user_id || 0, // Fallback if ID is not immediately present
            username: null // Let the service fetch it
        });

        return redirect("/app");

    } catch (err) {
        console.error("Callback Error:", err);
        return redirect("/app?error=" + encodeURIComponent(err.message));
    }
}
