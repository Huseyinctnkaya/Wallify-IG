import { prisma } from "../db.server";

export async function getSettings(shop) {
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

    return settings;
}

export async function saveSettings(shop, settings, admin = null) {
    const updatedSettings = await prisma.settings.upsert({
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

    if (admin) {
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
