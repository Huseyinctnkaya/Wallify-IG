import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { fetchUserProfile, saveInstagramAccount, syncInstagramToMetafields, getInstagramAccount } from "../models/instagram.server";
import { resetAnalyticsForShop } from "../models/analytics.server";
import {
    exchangeCodeForShortLivedToken,
    exchangeForLongLivedToken,
    verifyAndExtractInstagramState,
} from "../utils/instagram-oauth.server";

export const loader = async ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error_description")
        || url.searchParams.get("error_reason")
        || url.searchParams.get("error");

    if (oauthError) {
        const encoded = encodeURIComponent(String(oauthError).slice(0, 240));
        return redirect(`/app?ig_connect=error&ig_error=${encoded}`);
    }

    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    const statePayload = appSecret ? verifyAndExtractInstagramState(state, appSecret) : null;
    if (!statePayload?.shop) {
        return redirect("/app?ig_connect=error&ig_error=invalid_state");
    }
    const shop = statePayload.shop;

    if (!code) {
        return redirect("/app?ig_connect=error&ig_error=missing_code");
    }

    try {
        const shortTokenData = await exchangeCodeForShortLivedToken(code);
        let accessToken = shortTokenData.access_token;
        let userId = String(shortTokenData.user_id || "");

        try {
            const longLived = await exchangeForLongLivedToken(accessToken);
            accessToken = longLived.access_token;
        } catch (error) {
            // Keep short-lived token as fallback if long-lived exchange fails.
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

        try {
            const { admin } = await authenticate.admin(request);
            await syncInstagramToMetafields(shop, admin);
        } catch (error) {
            console.error("Initial metafield sync skipped (admin session missing):", error);
        }

        return redirect("/app?ig_connect=success");
    } catch (error) {
        console.error("Instagram callback failed:", error);
        const encoded = encodeURIComponent(String(error?.message || "oauth_failed").slice(0, 240));
        return redirect(`/app?ig_connect=error&ig_error=${encoded}`);
    }
};

export default function InstagramCallbackRoute() {
    return null;
}
