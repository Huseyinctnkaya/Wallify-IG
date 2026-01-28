import { prisma } from "../db.server";

// Instagram Graph API (Business Login) Endpoints
// Documentation: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
const INSTAGRAM_AUTH_URL = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com/v22.0"; // Always use a versioned endpoint

export async function getInstagramAuthUrl(shop, redirectUri, clientId) {
    const state = Buffer.from(shop).toString('base64');
    // Scopes for Business Login (Read Only for Feed)
    // instagram_business_basic: Read basic profile and media
    const scopes = ["instagram_business_basic"];

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scopes.join(","),
        response_type: "code",
        state: state,
    });

    return `${INSTAGRAM_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code, redirectUri, clientId, clientSecret) {
    const formData = new FormData();
    formData.append("client_id", clientId);
    formData.append("client_secret", clientSecret);
    formData.append("grant_type", "authorization_code");
    formData.append("redirect_uri", redirectUri);
    formData.append("code", code);

    const response = await fetch(INSTAGRAM_TOKEN_URL, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Instagram OAuth Error:", errorText);
        throw new Error(`Failed to exchange code: ${response.statusText}`);
    }

    const data = await response.json();
    // Standard OAuth response: { access_token, user_id, short_lived_token_ttl... }
    // Note: Business Login tokens are typically short-lived (1 hour) but can be exchanged or might be long-lived depending on flow.
    // For "Instagram Login", the token returned here is usually short-lived.
    return data;
}

export async function exchangeShortTokenForLong(shortLivedToken, clientSecret) {
    // For Instagram Business Login, swapping for long-lived token:
    // GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret={secret}&access_token={token}
    const params = new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_secret: clientSecret,
        access_token: shortLivedToken
    });

    const response = await fetch(`${INSTAGRAM_GRAPH_URL}/access_token?${params.toString()}`);

    if (!response.ok) {
        // Fallback: Sometimes the initial token is already long enough or different type. 
        // But if this fails, we just return the short one to keep app working for an hour at least.
        console.error("Failed to exchange for long-lived token, using short-lived");
        // We can throw or just return the short token structure to simulate pass-through
        return { access_token: shortLivedToken, expires_in: 3600 };
    }

    return await response.json(); // { access_token, token_type, expires_in }
}


export async function saveInstagramAccount({ shop, accessToken, userId, username }) {
    // We might not have username yet, fetch it if missing
    let finalUsername = username;
    if (!finalUsername) {
        try {
            const userProfile = await fetchUserProfile(accessToken);
            finalUsername = userProfile.username;
        } catch (e) {
            console.error("Could not fetch username during save:", e);
        }
    }

    return prisma.instagramAccount.upsert({
        where: { shop },
        update: {
            accessToken,
            userId: String(userId),
            username: finalUsername || "Instagram User",
            updatedAt: new Date(),
        },
        create: {
            shop,
            accessToken,
            userId: String(userId),
            username: finalUsername || "Instagram User",
        },
    });
}

export async function getInstagramAccount(shop) {
    return prisma.instagramAccount.findUnique({
        where: { shop },
    });
}

export async function disconnectInstagramAccount(shop) {
    return prisma.instagramAccount.delete({
        where: { shop }
    });
}

export async function fetchUserProfile(accessToken) {
    // me?fields=id,username,profile_picture_url
    const response = await fetch(`${INSTAGRAM_GRAPH_URL}/me?fields=id,username,profile_picture_url&access_token=${accessToken}`);
    if (!response.ok) throw new Error("Failed to fetch user profile");
    return await response.json();
}

export async function fetchUserMedia(accessToken) {
    // For Business Account: me/media?fields=...
    const fields = "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username";
    const response = await fetch(`${INSTAGRAM_GRAPH_URL}/me/media?fields=${fields}&access_token=${accessToken}&limit=12`);

    if (!response.ok) {
        const err = await response.text();
        console.error("Media Fetch Error:", err);
        throw new Error("Failed to fetch media from Instagram");
    }

    const data = await response.json();
    return data.data || [];
}

export async function syncInstagramToMetafields(shop, admin) {
    // 1. Get Account
    const account = await getInstagramAccount(shop);
    if (!account) throw new Error("No Instagram account connected");

    // 2. Fetch Media
    let mediaItems = [];
    try {
        mediaItems = await fetchUserMedia(account.accessToken);
    } catch (e) {
        console.error("Sync Error:", e);
        throw e;
    }

    // 3. Format Data for Metafield
    const jsonValue = JSON.stringify(mediaItems.map(item => ({
        id: item.id,
        url: item.media_url,
        thumbnail: item.thumbnail_url || item.media_url,
        permalink: item.permalink,
        caption: item.caption,
        type: item.media_type
    })));

    // 4. Save to Metafield
    const response = await admin.graphql(
        `#graphql
        mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              key
              namespace
              value
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
            variables: {
                metafields: [
                    {
                        namespace: "instagram_feed",
                        key: "media",
                        type: "json",
                        value: jsonValue,
                        ownerId: (await getShopId(admin))
                    }
                ]
            },
        }
    );

    const result = await response.json();
    return result.data.metafieldsSet;
}

async function getShopId(admin) {
    const response = await admin.graphql(
        `#graphql
        query {
            shop {
                id
            }
        }`
    );
    const data = await response.json();
    return data.data.shop.id;
}
