import { prisma } from "../db.server";

const INSTAGRAM_API_URL = "https://api.instagram.com";
const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com";

export async function getInstagramAuthUrl(shop, redirectUri, clientId) {
    const state = Buffer.from(shop).toString('base64');
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "user_profile,user_media",
        response_type: "code",
        state: state,
    });

    return `${INSTAGRAM_API_URL}/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code, redirectUri, clientId, clientSecret) {
    const formData = new FormData();
    formData.append("client_id", clientId);
    formData.append("client_secret", clientSecret);
    formData.append("grant_type", "authorization_code");
    formData.append("redirect_uri", redirectUri);
    formData.append("code", code);

    const response = await fetch(`${INSTAGRAM_API_URL}/oauth/access_token`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Instagram OAuth Error:", errorText);
        throw new Error(`Failed to exchange code: ${response.statusText}`);
    }

    const data = await response.json();
    return data; // { access_token, user_id }
}

export async function exchangeShortTokenForLong(shortLivedToken, clientSecret) {
    const params = new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_secret: clientSecret,
        access_token: shortLivedToken
    });

    const response = await fetch(`${INSTAGRAM_GRAPH_URL}/access_token?${params.toString()}`);

    if (!response.ok) {
        throw new Error("Failed to exchange for long-lived token");
    }

    return await response.json(); // { access_token, token_type, expires_in }
}


export async function saveInstagramAccount({ shop, accessToken, userId, username }) {
    return prisma.instagramAccount.upsert({
        where: { shop },
        update: {
            accessToken,
            userId: String(userId),
            username,
            updatedAt: new Date(),
        },
        create: {
            shop,
            accessToken,
            userId: String(userId),
            username,
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

export async function fetchUserMedia(accessToken) {
    // Basic Display API for Media
    const fields = "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username";
    const response = await fetch(`${INSTAGRAM_GRAPH_URL}/me/media?fields=${fields}&access_token=${accessToken}&limit=12`);

    if (!response.ok) {
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
        // If error is token expired, we might need to refresh? 
        // For now, just throw
        throw e;
    }

    // 3. Format Data for Metafield
    // We store a JSON string of the media items
    const jsonValue = JSON.stringify(mediaItems.map(item => ({
        id: item.id,
        url: item.media_url,
        thumbnail: item.thumbnail_url || item.media_url,
        permalink: item.permalink,
        caption: item.caption,
        type: item.media_type
    })));

    // 4. Save to Metafield (App-owned or Shop-owned? usually App-owned if using App Definitions, 
    // but standard Metafields are easier for themes to access directly via 'app.metafields...')

    // We'll use the GraphQL Admin API via the `admin` object passed from the loader/action.
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
                        ownerId: (await getShopId(admin)) // We need the Shop ID. 
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
