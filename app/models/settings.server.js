import { prisma } from "../db.server";
import { setShopMetafields } from "./shopify-metafields.server";

/**
 * Shape and defaults for a shop that has never saved settings.
 * Mirrors the `@default` values on the Settings model in schema.prisma.
 */
export const DEFAULT_SETTINGS = {
    title: "INSTAGRAM'DA BİZ",
    subheading: "Daha Fazlası İçin Bizi Takip Edebilirsiniz",
    buttonText: "Open in Instagram",
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

export async function getSettings(shop) {
    // Reads are on the dashboard's critical path: fall back to defaults so a
    // database blip renders an unconfigured feed rather than an error page.
    // Writes deliberately do NOT swallow errors - see saveSettings.
    try {
        const settings = await prisma.settings.findUnique({ where: { shop } });
        return settings ?? { ...DEFAULT_SETTINGS };
    } catch (error) {
        console.error("Settings fetch failed, serving defaults:", error);
        return { ...DEFAULT_SETTINGS };
    }
}

export async function saveSettings(shop, settings, admin = null) {
    const updatedSettings = await prisma.settings.upsert({
        where: { shop },
        update: settings,
        create: { shop, ...settings },
    });

    if (admin) {
        await syncSettingsToMetafields(shop, admin, updatedSettings);
    }

    return updatedSettings;
}

export async function syncSettingsToMetafields(shop, admin, settings) {
    const currentSettings = settings || (await getSettings(shop));

    // Strip database bookkeeping columns; the storefront only needs the config.
    const { id: _id, shop: _shop, createdAt: _createdAt, updatedAt: _updatedAt, ...cleanSettings } =
        currentSettings;

    return setShopMetafields(admin, [
        {
            key: "settings",
            type: "json",
            value: JSON.stringify(cleanSettings),
        },
    ]);
}
