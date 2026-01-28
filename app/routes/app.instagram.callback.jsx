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
        return redirect("/app/settings?error=" + encodeURIComponent(errorDescription || "Authorization failed"));
    }

    if (!code) {
        return redirect("/app/settings?error=No code returned");
    }

    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
    const appUrl = process.env.SHOPIFY_APP_URL;

    if (!clientId || !clientSecret || !appUrl) {
        console.error("Missing ENV variables for Instagram");
        return redirect("/app/settings?error=Server misconfiguration");
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
        await saveInstagramAccount({
            shop,
            accessToken: longData.access_token,
            userId: shortData.user_id, // Instagram Basic Display returns ID here
            username: "" // We actually need to fetch the username separately if we want it, but let's skip for speed or do it later
        });

        return redirect("/app/settings");

    } catch (err) {
        console.error("Callback Error:", err);
        return redirect("/app/settings?error=" + encodeURIComponent(err.message));
    }
}
