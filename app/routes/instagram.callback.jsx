import { redirect } from "@remix-run/node";
import { fetchUserProfile, saveInstagramAccount, getInstagramAccount } from "../models/instagram.server";
import { resetAnalyticsForShop } from "../models/analytics.server";
import {
    exchangeCodeForShortLivedToken,
    exchangeForLongLivedToken,
    verifyAndExtractInstagramState,
} from "../utils/instagram-oauth.server";

/**
 * Build the Shopify admin embedded app URL so we can redirect
 * back into the embedded app after Instagram OAuth.
 */
function buildEmbeddedAppUrl(shop, queryParams = "") {
    const apiKey = process.env.SHOPIFY_API_KEY;
    // shop is like "devsapig.myshopify.com"
    return `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/${apiKey}${queryParams}`;
}

export const loader = async ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error_description")
        || url.searchParams.get("error_reason")
        || url.searchParams.get("error");

    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    const statePayload = appSecret ? verifyAndExtractInstagramState(state, appSecret) : null;
    const shop = statePayload?.shop || "";

    if (oauthError) {
        if (shop) {
            const encoded = encodeURIComponent(String(oauthError).slice(0, 240));
            return redirect(buildEmbeddedAppUrl(shop, `?ig_connect=error&ig_error=${encoded}`));
        }
        return redirect("/app?ig_connect=error&ig_error=" + encodeURIComponent(String(oauthError).slice(0, 240)));
    }

    if (!shop) {
        return redirect("/app?ig_connect=error&ig_error=invalid_state");
    }

    if (!code) {
        return redirect(buildEmbeddedAppUrl(shop, "?ig_connect=error&ig_error=missing_code"));
    }

    try {
        // Step 1: Exchange code for short-lived token
        console.log("Instagram callback: exchanging code for short-lived token...");
        const shortTokenData = await exchangeCodeForShortLivedToken(code);
        const shortLivedToken = shortTokenData.access_token;
        let userId = String(shortTokenData.user_id || "");
        console.log("Instagram callback: short-lived token obtained, userId:", userId);

        // Step 2: Fetch profile with short-lived token FIRST (before long-lived exchange)
        console.log("Instagram callback: fetching user profile with short-lived token...");
        const profile = await fetchUserProfile(shortLivedToken, userId);
        console.log("Instagram callback: profile fetched, username:", profile.username);
        userId = String(profile.id || profile.user_id || userId);

        // Step 3: Exchange for long-lived token (for storage)
        let accessToken = shortLivedToken;
        try {
            console.log("Instagram callback: exchanging for long-lived token...");
            const longLived = await exchangeForLongLivedToken(shortLivedToken);
            accessToken = longLived.access_token;
            console.log("Instagram callback: long-lived token obtained");
        } catch (error) {
            console.error("Long-lived token exchange failed, using short-lived token:", error);
        }

        // Step 4: Check if account changed
        const existingAccount = await getInstagramAccount(shop);
        const accountChanged = !!(
            existingAccount?.userId &&
            String(existingAccount.userId) !== String(userId)
        );

        // Step 5: Save account with best available token
        await saveInstagramAccount({
            shop,
            accessToken,
            userId,
            username: profile.username,
            profilePictureUrl: profile.profile_picture_url || null,
        });

        if (accountChanged) {
            await resetAnalyticsForShop(shop);
        }

        return redirect(buildEmbeddedAppUrl(shop, "?ig_connect=success"));
    } catch (error) {
        console.error("Instagram callback failed:", error);
        const encoded = encodeURIComponent(String(error?.message || "oauth_failed").slice(0, 240));
        return redirect(buildEmbeddedAppUrl(shop, `?ig_connect=error&ig_error=${encoded}`));
    }
};

export default function InstagramCallbackRoute() {
    return null;
}
