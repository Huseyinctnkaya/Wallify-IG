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

    // Calculate week-over-week changes
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - 7);
    currentWeekStart.setHours(0, 0, 0, 0);

    const previousWeekStart = new Date(now);
    previousWeekStart.setDate(now.getDate() - 14);
    previousWeekStart.setHours(0, 0, 0, 0);

    const previousWeekEnd = new Date(currentWeekStart);
    previousWeekEnd.setSeconds(-1); // End of previous week

    // Current week stats (last 7 days)
    const currentWeekStats = dailyStats.filter(stat => {
        const statDate = new Date(stat.date);
        return statDate >= currentWeekStart;
    });

    // Previous week stats (7-14 days ago)
    const previousWeekStats = dailyStats.filter(stat => {
        const statDate = new Date(stat.date);
        return statDate >= previousWeekStart && statDate <= previousWeekEnd;
    });

    // Calculate current week totals
    const currentWeekTotals = currentWeekStats.reduce((acc, curr) => {
        acc.views += curr.views;
        acc.clicks += curr.clicks;
        return acc;
    }, { views: 0, clicks: 0 });

    // Calculate previous week totals
    const previousWeekTotals = previousWeekStats.reduce((acc, curr) => {
        acc.views += curr.views;
        acc.clicks += curr.clicks;
        return acc;
    }, { views: 0, clicks: 0 });

    // Calculate CTR for both weeks
    const currentWeekCTR = currentWeekTotals.views > 0
        ? (currentWeekTotals.clicks / currentWeekTotals.views) * 100
        : 0;
    const previousWeekCTR = previousWeekTotals.views > 0
        ? (previousWeekTotals.clicks / previousWeekTotals.views) * 100
        : 0;

    // Calculate percentage changes
    const calculateChange = (current, previous) => {
        if (previous === 0) {
            return current > 0 ? 100 : 0; // If no previous data but have current, show 100% increase
        }
        return ((current - previous) / previous) * 100;
    };

    const viewsChange = calculateChange(currentWeekTotals.views, previousWeekTotals.views);
    const clicksChange = calculateChange(currentWeekTotals.clicks, previousWeekTotals.clicks);
    const ctrChange = calculateChange(currentWeekCTR, previousWeekCTR);
    const engagementChange = calculateChange(
        currentWeekTotals.views + currentWeekTotals.clicks,
        previousWeekTotals.views + previousWeekTotals.clicks
    );

    return {
        dailyStats,
        totals: {
            ...totals,
            ctr: ctr.toFixed(2)
        },
        weekOverWeek: {
            views: viewsChange,
            clicks: clicksChange,
            ctr: ctrChange,
            engagement: engagementChange
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
