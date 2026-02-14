import { prisma } from "../db.server";

export async function getAnalytics(shop, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily stats
    const dailyStats = await prisma.analytics.findMany({
        where: {
            shop,
            date: {
                gte: startDate
            }
        },
        orderBy: {
            date: 'asc'
        }
    });

    // Aggregate totals
    const totals = dailyStats.reduce((acc, curr) => {
        acc.views += curr.views;
        acc.clicks += curr.clicks;
        return acc;
    }, { views: 0, clicks: 0 });

    const ctr = totals.views > 0 ? (totals.clicks / totals.views) * 100 : 0;

    return {
        dailyStats,
        totals: {
            ...totals,
            ctr: ctr.toFixed(2)
        }
    };
}

export async function getTopPostsAnalytics(shop, limit = 5) {
    return prisma.postAnalytics.findMany({
        where: { shop },
        orderBy: {
            clicks: 'desc'
        },
        take: limit
    });
}

export async function trackMetric(shop, type, { mediaId = null, mediaUrl = null, permalink = null } = {}) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Global daily stats
    await prisma.analytics.upsert({
        where: {
            shop_date: {
                shop,
                date: today
            }
        },
        update: {
            views: type === 'view' ? { increment: 1 } : undefined,
            clicks: type === 'click' ? { increment: 1 } : undefined,
        },
        create: {
            shop,
            date: today,
            views: type === 'view' ? 1 : 0,
            clicks: type === 'click' ? 1 : 0,
        }
    });

    // Per-post stats
    if (mediaId) {
        await prisma.postAnalytics.upsert({
            where: {
                shop_mediaId: {
                    shop,
                    mediaId
                }
            },
            update: {
                views: type === 'view' ? { increment: 1 } : undefined,
                clicks: type === 'click' ? { increment: 1 } : undefined,
                mediaUrl: mediaUrl || undefined,
                permalink: permalink || undefined,
            },
            create: {
                shop,
                mediaId,
                mediaUrl,
                permalink,
                views: type === 'view' ? 1 : 0,
                clicks: type === 'click' ? 1 : 0,
            }
        });
    }
}
