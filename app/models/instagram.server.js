import { prisma } from "../db.server";
import { getPosts } from "./post.server";
import { getSettings } from "./settings.server";
import { isPremiumShop } from "../utils/premium.server";

// Instagram Graph API Endpoints
const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com";

/**
 * Fetch carousel children for a media item
 */
async function fetchCarouselChildren(mediaId, accessToken) {
    const fields = "id,media_type,media_url,thumbnail_url";
    const url = `${INSTAGRAM_GRAPH_URL}/${mediaId}/children?fields=${fields}&access_token=${accessToken}`;

    try {
        const response = await fetch(url);
        if (!response.ok) return [];

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error(`Failed to fetch children for ${mediaId}:`, error);
        return [];
    }
}

/**
 * Fetch Instagram user's media using Graph API
 * Requires: Instagram Business or Creator account connected via Meta Business Suite
 * Now includes carousel children for multi-image posts
 */
export async function fetchInstagramMedia(instagramUserId, accessToken, limit = null) {
    const fields = "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username";
    const parsedLimit = Number.isFinite(Number(limit)) && Number(limit) > 0
        ? Number(limit)
        : null;

    const pageLimit = parsedLimit ? Math.min(parsedLimit, 100) : 100;
    let nextUrl = `${INSTAGRAM_GRAPH_URL}/${instagramUserId}/media?fields=${fields}&access_token=${accessToken}&limit=${pageLimit}`;

    const mediaItems = [];
    let pageCount = 0;
    const maxPages = 50;

    while (nextUrl && pageCount < maxPages) {
        const response = await fetch(nextUrl);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Instagram Graph API Error:", errorText);
            throw new Error(`Failed to fetch media: ${response.statusText}`);
        }

        const data = await response.json();
        const pageItems = data.data || [];

        if (parsedLimit) {
            const remaining = parsedLimit - mediaItems.length;
            if (remaining <= 0) break;
            mediaItems.push(...pageItems.slice(0, remaining));
        } else {
            mediaItems.push(...pageItems);
        }

        if (parsedLimit && mediaItems.length >= parsedLimit) break;
        nextUrl = data?.paging?.next || null;
        pageCount += 1;
    }

    // Fetch children for carousel posts
    const enrichedMedia = await Promise.all(
        mediaItems.map(async (item) => {
            if (item.media_type === "CAROUSEL_ALBUM") {
                const children = await fetchCarouselChildren(item.id, accessToken);
                return { ...item, children };
            }
            return { ...item, children: [] };
        })
    );

    return enrichedMedia;
}

/**
 * Fetch Instagram user profile
 * Use 'me' endpoint to get the authenticated user's profile
 */
export async function fetchUserProfile(accessToken) {
    const fields = "id,username,account_type,media_count,profile_picture_url";
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
export async function saveInstagramAccount({ shop, accessToken, userId, username, profilePictureUrl }) {
    return prisma.instagramAccount.upsert({
        where: { shop },
        update: {
            accessToken,
            userId: String(userId),
            username: username || "Instagram User",
            profilePictureUrl: profilePictureUrl || null,
            updatedAt: new Date(),
        },
        create: {
            shop,
            accessToken,
            userId: String(userId),
            username: username || "Instagram User",
            profilePictureUrl: profilePictureUrl || null,
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
 * Now includes Post metadata (pin/hide/products)
 */
export async function syncInstagramToMetafields(shop, admin) {
    const account = await getInstagramAccount(shop);
    if (!account) {
        throw new Error("No Instagram account connected");
    }

    // Always refresh profile picture
    try {
        const profile = await fetchUserProfile(account.accessToken);
        console.log("Instagram profile response:", JSON.stringify(profile));
        if (profile.profile_picture_url) {
            await saveInstagramAccount({
                shop,
                accessToken: account.accessToken,
                userId: account.userId,
                username: account.username,
                profilePictureUrl: profile.profile_picture_url,
            });
            account.profilePictureUrl = profile.profile_picture_url;
        }
    } catch (e) {
        console.error("Failed to refresh profile picture:", e);
    }

    // Fetch settings and post records
    const settings = await getSettings(shop);
    const isPremium = await isPremiumShop(shop);
    const configuredMediaLimit = Number(settings.mediaLimit);
    const premiumMediaLimit = Number.isFinite(configuredMediaLimit) && configuredMediaLimit > 0
        ? configuredMediaLimit
        : 12;
    const freeMediaLimit = Math.min(Number(settings.mediaLimit) || 12, 12);
    const effectiveMediaLimit = isPremium ? premiumMediaLimit : freeMediaLimit;
    const postRecords = await getPosts(shop);

    let mediaItems = [];
    try {
        mediaItems = await fetchInstagramMedia(
            account.userId,
            account.accessToken,
            effectiveMediaLimit
        );
    } catch (error) {
        console.error("Sync Error:", error);
        throw error;
    }

    // Merge Instagram media with Post metadata
    let enrichedMedia = mediaItems.map(item => {
        const record = postRecords.find(p => p.mediaId === item.id);

        return {
            id: item.id,
            url: item.media_url,
            thumbnail: item.thumbnail_url || item.media_url,
            permalink: item.permalink,
            caption: item.caption || "",
            type: item.media_type,
            username: item.username || account.username,
            timestamp: item.timestamp,
            // Carousel children (for multi-image posts)
            children: item.children || [],
            // Post metadata
            isPinned: record?.isPinned || false,
            isHidden: record?.isHidden || false,
            products: record?.products ? JSON.parse(record.products) : []
        };
    });

    // Filter: Remove hidden posts from theme display
    enrichedMedia = enrichedMedia.filter(item => !item.isHidden);

    // Filter: Apply showPinnedReels setting
    if (isPremium && settings.showPinnedReels) {
        enrichedMedia = enrichedMedia.filter(item => item.isPinned);
    }

    // Sort: Pinned posts first
    enrichedMedia.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
    });

    const jsonValue = JSON.stringify(enrichedMedia);

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

    const metafieldsPayload = [
        {
            namespace: "instagram_feed",
            key: "media",
            type: "json",
            value: jsonValue,
            ownerId: shopId
        }
    ];

    if (account.profilePictureUrl) {
        metafieldsPayload.push({
            namespace: "instagram_feed",
            key: "profile_picture_url",
            type: "single_line_text_field",
            value: account.profilePictureUrl,
            ownerId: shopId
        });
    }

    const appUrl = process.env.SHOPIFY_APP_URL?.replace(/\/$/, "");
    if (appUrl) {
        metafieldsPayload.push({
            namespace: "instagram_feed",
            key: "tracking_url",
            type: "single_line_text_field",
            value: `${appUrl}/api/track`,
            ownerId: shopId
        });
    }

    // Save to metafields
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
                metafields: metafieldsPayload
            },
        }
    );

    const result = await response.json();

    if (result.data.metafieldsSet.userErrors.length > 0) {
        throw new Error(result.data.metafieldsSet.userErrors[0].message);
    }

    return result.data.metafieldsSet;
}
