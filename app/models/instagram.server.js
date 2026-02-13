import { prisma } from "../db.server";

// Instagram Graph API Endpoints
const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com";

/**
 * Fetch Instagram user's media using Graph API
 * Requires: Instagram Business or Creator account connected via Meta Business Suite
 */
export async function fetchInstagramMedia(instagramUserId, accessToken) {
    const fields = "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username";
    const url = `${INSTAGRAM_GRAPH_URL}/${instagramUserId}/media?fields=${fields}&access_token=${accessToken}&limit=12`;

    const response = await fetch(url);

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Instagram Graph API Error:", errorText);
        throw new Error(`Failed to fetch media: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
}

/**
 * Fetch Instagram user profile
 * Use 'me' endpoint to get the authenticated user's profile
 */
export async function fetchUserProfile(accessToken) {
    const fields = "id,username,account_type,media_count";
    const url = `${INSTAGRAM_GRAPH_URL}/me?fields=${fields}&access_token=${accessToken}`;

    const response = await fetch(url);

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Instagram Profile Error:", errorText);
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Save Instagram account to database
 */
export async function saveInstagramAccount({ shop, accessToken, userId, username }) {
    return prisma.instagramAccount.upsert({
        where: { shop },
        update: {
            accessToken,
            userId: String(userId),
            username: username || "Instagram User",
            updatedAt: new Date(),
        },
        create: {
            shop,
            accessToken,
            userId: String(userId),
            username: username || "Instagram User",
        },
    });
}

/**
 * Get Instagram account from database
 */
export async function getInstagramAccount(shop) {
    return prisma.instagramAccount.findUnique({
        where: { shop },
    });
}

/**
 * Disconnect Instagram account
 */
export async function disconnectInstagramAccount(shop) {
    return prisma.instagramAccount.delete({
        where: { shop },
    });
}

/**
 * Sync Instagram media to Shopify metafields
 */
export async function syncInstagramToMetafields(shop, admin) {
    const account = await getInstagramAccount(shop);
    if (!account) {
        throw new Error("No Instagram account connected");
    }

    let mediaItems = [];
    try {
        mediaItems = await fetchInstagramMedia(account.userId, account.accessToken);
    } catch (error) {
        console.error("Sync Error:", error);
        throw error;
    }

    // Format media for metafield
    const formattedMedia = mediaItems.map(item => ({
        id: item.id,
        url: item.media_url,
        thumbnail: item.thumbnail_url || item.media_url,
        permalink: item.permalink,
        caption: item.caption || "",
        type: item.media_type
    }));

    const jsonValue = JSON.stringify(formattedMedia);

    // Get shop ID for metafield owner
    const shopIdResponse = await admin.graphql(`
        query {
            shop {
                id
            }
        }
    `);
    const shopIdData = await shopIdResponse.json();
    const shopId = shopIdData.data.shop.id;

    // Save to metafield
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
                        ownerId: shopId
                    }
                ]
            },
        }
    );

    const result = await response.json();

    if (result.data.metafieldsSet.userErrors.length > 0) {
        throw new Error(result.data.metafieldsSet.userErrors[0].message);
    }

    return result.data.metafieldsSet;
}
