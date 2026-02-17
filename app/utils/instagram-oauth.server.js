import crypto from "node:crypto";

const INSTAGRAM_AUTH_URL = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_LONG_LIVED_URL = "https://graph.instagram.com/access_token";
const INSTAGRAM_DEFAULT_SCOPES = "instagram_business_basic";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function sign(value, secret) {
    return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function getInstagramRedirectUri() {
    const appUrl = process.env.SHOPIFY_APP_URL?.replace(/\/$/, "");
    if (!appUrl) {
        throw new Error("SHOPIFY_APP_URL is not configured");
    }
    return `${appUrl}/instagram/callback`;
}

export function buildInstagramAuthUrl({ shop }) {
    const appId = process.env.INSTAGRAM_APP_ID;
    const clientId = process.env.INSTAGRAM_CLIENT_ID || appId;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    if (!appId || !clientId || !appSecret) {
        throw new Error("INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET are not configured");
    }

    const redirectUri = getInstagramRedirectUri();
    const scope = process.env.INSTAGRAM_SCOPES || INSTAGRAM_DEFAULT_SCOPES;
    const state = createInstagramState(shop, appSecret);
    const authUrl = process.env.INSTAGRAM_AUTH_URL || INSTAGRAM_AUTH_URL;

    const url = new URL(authUrl);
    url.searchParams.set("client_id", clientId);
    // Keep compatibility with Instagram Business Login where app_id is expected.
    url.searchParams.set("app_id", appId);
    // Some Instagram Business Login apps validate this explicitly.
    url.searchParams.set("platform_app_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scope);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    url.searchParams.set(
        "enable_fb_login",
        process.env.INSTAGRAM_ENABLE_FB_LOGIN || "1"
    );
    url.searchParams.set(
        "force_authentication",
        process.env.INSTAGRAM_FORCE_AUTHENTICATION || "1"
    );

    return url.toString();
}

export function createInstagramState(shop, secret) {
    const payload = {
        shop,
        ts: Date.now(),
        nonce: crypto.randomBytes(8).toString("hex"),
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = sign(encodedPayload, secret);
    return `${encodedPayload}.${signature}`;
}

export function verifyInstagramState(state, expectedShop, secret) {
    const payload = verifyAndExtractInstagramState(state, secret);
    if (!payload) return false;
    return payload.shop === expectedShop;
}

export function verifyAndExtractInstagramState(state, secret) {
    if (!state || !secret) return false;

    const [encodedPayload, signature] = String(state).split(".");
    if (!encodedPayload || !signature) return false;

    const expectedSignature = sign(encodedPayload, secret);
    if (signature.length !== expectedSignature.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return false;

    let payload;
    try {
        payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    } catch (_) {
        return false;
    }

    if (!payload?.shop) return false;
    if (!payload?.ts || Date.now() - payload.ts > STATE_MAX_AGE_MS) return false;

    return payload;
}

export async function exchangeCodeForShortLivedToken(code) {
    const appId = process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    const redirectUri = getInstagramRedirectUri();

    if (!appId || !appSecret) {
        throw new Error("INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET are not configured");
    }

    const body = new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
    });

    const response = await fetch(INSTAGRAM_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.access_token) {
        const message = data?.error_message || data?.error?.message || response.statusText;
        throw new Error(`Instagram token exchange failed: ${message}`);
    }

    return data;
}

export async function exchangeForLongLivedToken(shortLivedToken) {
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    if (!appSecret) {
        throw new Error("INSTAGRAM_APP_SECRET is not configured");
    }

    const url = new URL(INSTAGRAM_LONG_LIVED_URL);
    url.searchParams.set("grant_type", "ig_exchange_token");
    url.searchParams.set("client_secret", appSecret);
    url.searchParams.set("access_token", shortLivedToken);

    const response = await fetch(url.toString());
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.access_token) {
        const message = data?.error?.message || response.statusText;
        throw new Error(`Instagram long-lived token exchange failed: ${message}`);
    }

    return data;
}
