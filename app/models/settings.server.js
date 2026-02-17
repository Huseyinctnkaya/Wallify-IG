// Last Sync: 2026-02-14 23:25
import { prisma } from "../db.server";

export async function getSettings(shop) {
    try {
        const settings = await prisma.settings.findUnique({
            where: { shop },
        });

        if (!settings) {
            return {
                title: "INSTAGRAM'DA BİZ",
                subheading: "Daha Fazlası İçin Bizi Takip Edebilirsiniz",
                feedType: "slider",
                showPinnedReels: false,
                gridDesktopColumns: 4,
                gridMobileColumns: 2,
                sliderDesktopColumns: 4,
                sliderMobileColumns: 2,
                showArrows: true,
                mediaLimit: 12,
                onClick: "popup",
                postSpacing: "medium",
                borderRadius: "medium",
                playVideoOnHover: false,
                showThumbnail: false,
                showViewsCount: false,
                showAuthorProfile: true,
                showAttachedProducts: true,
                cleanDisplay: false,
                titleColor: "#000000",
                subheadingColor: "#6d7175",
                arrowColor: "#000000",
                arrowBackgroundColor: "#ffffff",
                cardUserNameColor: "#ffffff",
                cardBadgeBackgroundColor: "rgba(0,0,0,0.5)",
                cardBadgeIconColor: "#ffffff",
            };
        }

        return settings;
    } catch (error) {
        console.error("Settings fetch failed (likely schema mismatch):", error);
        // Return defaults as fallback to prevent app crash
        return {
            title: "INSTAGRAM'DA BİZ",
            subheading: "Daha Fazlası İçin Bizi Takip Edebilirsiniz",
            feedType: "slider",
            showPinnedReels: false,
            gridDesktopColumns: 4,
            gridMobileColumns: 2,
            sliderDesktopColumns: 4,
            sliderMobileColumns: 2,
            showArrows: true,
            mediaLimit: 12,
            onClick: "popup",
            postSpacing: "medium",
            borderRadius: "medium",
            playVideoOnHover: false,
            showThumbnail: false,
            showViewsCount: false,
            showAuthorProfile: true,
            showAttachedProducts: true,
            titleColor: "#000000",
            subheadingColor: "#6d7175",
            arrowColor: "#000000",
            arrowBackgroundColor: "#ffffff",
            cardUserNameColor: "#ffffff",
            cardBadgeBackgroundColor: "rgba(0,0,0,0.5)",
            cardBadgeIconColor: "#ffffff",
        };
    }
}

export async function saveSettings(shop, settings, admin = null) {
    let updatedSettings;
    try {
        updatedSettings = await prisma.settings.upsert({
            where: { shop },
            update: {
                ...settings,
                updatedAt: new Date(),
            },
            create: {
                shop,
                ...settings,
            },
        });
    } catch (error) {
        console.error("Critical: Prisma save failed with full object:", error.message);

        // Fallback: If it's a validation error about mediaLimit, try saving without it
        if (error.message.includes("Unknown argument `mediaLimit`")) {
            console.log("Retrying save without mediaLimit due to client mismatch...");
            const { mediaLimit, ...safeSettings } = settings;
            updatedSettings = await prisma.settings.upsert({
                where: { shop },
                update: {
                    ...safeSettings,
                    updatedAt: new Date(),
                },
                create: {
                    shop,
                    ...safeSettings,
                },
            });
        } else {
            throw error;
        }
    }

    if (admin && updatedSettings) {
        try {
            await syncSettingsToMetafields(shop, admin, updatedSettings);
        } catch (error) {
            console.error("Failed to sync settings to metafields:", error);
        }
    }

    return updatedSettings;
}

export async function syncSettingsToMetafields(shop, admin, settings) {
    // If settings not provided, fetch them
    const currentSettings = settings || await getSettings(shop);

    // Remove database specific fields
    const { id, shop: _, createdAt, updatedAt, ...cleanSettings } = currentSettings;

    const jsonValue = JSON.stringify(cleanSettings);

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
                    id
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
                        key: "settings",
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
