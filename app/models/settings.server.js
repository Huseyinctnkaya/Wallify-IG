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
            desktopColumns: 4,
            mobileColumns: 2,
            showArrows: true,
            onClick: "popup",
            postSpacing: "medium",
            borderRadius: "medium",
            playVideoOnHover: false,
            showThumbnail: false,
            showViewsCount: false,
            showAuthorProfile: true,
            showAttachedProducts: true,
        };
    }

    return settings;
}

export async function saveSettings(shop, settings) {
    return prisma.settings.upsert({
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
}
