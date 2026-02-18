import { redirect } from "@remix-run/node";
import { fetchUserProfile, saveInstagramAccount, getInstagramAccount } from "../models/instagram.server";
import { resetAnalyticsForShop } from "../models/analytics.server";
import {
    exchangeCodeForShortLivedToken,
    exchangeForLongLivedToken,
    verifyAndExtractInstagramState,
} from "../utils/instagram-oauth.server";
import { igAuthShopCookie } from "../utils/cookies.server";

/**
 * Build the Shopify admin embedded app URL so we can redirect
 * back into the embedded app after Instagram OAuth.
 */
function buildEmbeddedAppUrl(shop, queryParams = "") {
    const apiKey = process.env.SHOPIFY_API_KEY;
    if (!shop) return `/app${queryParams}`;
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

    const cookieHeader = request.headers.get("Cookie");
    const cookieShop = (await igAuthShopCookie.parse(cookieHeader)) || "";

    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    const statePayload = appSecret ? verifyAndExtractInstagramState(state, appSecret) : null;
    let shop = statePayload?.shop || cookieShop || "";

    // Clear the cookie in all cases once we're done with the fallback
    const headers = {
        "Set-Cookie": await igAuthShopCookie.serialize("", { maxAge: 0 }),
    };

    if (oauthError) {
        const encoded = encodeURIComponent(String(oauthError).slice(0, 240));
        return redirect(buildEmbeddedAppUrl(shop, `?ig_connect=error&ig_error=${encoded}`), { headers });
    }

    if (!shop) {
        return redirect("/app?ig_connect=error&ig_error=invalid_state", { headers });
    }

    if (!code) {
        return redirect(buildEmbeddedAppUrl(shop, "?ig_connect=error&ig_error=missing_code"), { headers });
    }

    try {
        const shortTokenData = await exchangeCodeForShortLivedToken(code);
        let accessToken = shortTokenData.access_token;
        let userId = String(shortTokenData.user_id || "");

        try {
            const longLived = await exchangeForLongLivedToken(accessToken);
            accessToken = longLived.access_token;
        } catch (error) {
            console.error("Long-lived token exchange failed, using short-lived token:", error);
        }

        const profile = await fetchUserProfile(accessToken);
        userId = String(profile.id || userId);
        const existingAccount = await getInstagramAccount(shop);
        const accountChanged = !!(
            existingAccount?.userId &&
            String(existingAccount.userId) !== String(userId)
        );

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

        return redirect(buildEmbeddedAppUrl(shop, "?ig_connect=success"), { headers });
    } catch (error) {
        console.error("Instagram callback failed:", error);
        const encoded = encodeURIComponent(String(error?.message || "oauth_failed").slice(0, 240));
        return redirect(buildEmbeddedAppUrl(shop, `?ig_connect=error&ig_error=${encoded}`), { headers });
    }
};

export default function InstagramCallbackRoute() {
    return null;
}
