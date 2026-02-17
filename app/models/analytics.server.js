import { prisma } from "../db.server";

function getStartOfDay(date) {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    return day;
}

function calculateChange(current, previous) {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
}

export async function getAnalytics(shop, days = 30) {
    const safeDays = Math.max(1, Number(days) || 30);
    const now = new Date();
    const startDate = getStartOfDay(now);
    startDate.setDate(startDate.getDate() - (safeDays - 1));

    // Keep at least 14 days of source data for week-over-week comparison.
    const comparisonWindowStart = getStartOfDay(now);
    comparisonWindowStart.setDate(comparisonWindowStart.getDate() - 13);

    const queryStartDate = comparisonWindowStart < startDate
        ? comparisonWindowStart
        : startDate;

    const rawStats = await prisma.analytics.findMany({
        where: {
            shop,
            date: {
                gte: queryStartDate
            }
        },
        orderBy: {
            date: 'asc'
        }
    });

    const dailyStats = rawStats.filter((stat) => new Date(stat.date) >= startDate);

    // Aggregate totals for selected range
    const totals = dailyStats.reduce((acc, curr) => {
        acc.views += curr.views;
        acc.clicks += curr.clicks;
        return acc;
    }, { views: 0, clicks: 0 });

    const ctr = totals.views > 0 ? (totals.clicks / totals.views) * 100 : 0;

    // Calculate week-over-week changes from the last 14 days.
    const currentWeekStart = getStartOfDay(now);
    currentWeekStart.setDate(currentWeekStart.getDate() - 6);

    const previousWeekStart = getStartOfDay(now);
    previousWeekStart.setDate(previousWeekStart.getDate() - 13);

    const currentWeekStats = rawStats.filter(stat => {
        const statDate = new Date(stat.date);
        return statDate >= currentWeekStart;
    });

    const previousWeekStats = rawStats.filter(stat => {
        const statDate = new Date(stat.date);
        return statDate >= previousWeekStart && statDate < currentWeekStart;
    });

    const currentWeekTotals = currentWeekStats.reduce((acc, curr) => {
        acc.views += curr.views;
        acc.clicks += curr.clicks;
        return acc;
    }, { views: 0, clicks: 0 });

    const previousWeekTotals = previousWeekStats.reduce((acc, curr) => {
        acc.views += curr.views;
        acc.clicks += curr.clicks;
        return acc;
    }, { views: 0, clicks: 0 });

    const currentWeekCTR = currentWeekTotals.views > 0
        ? (currentWeekTotals.clicks / currentWeekTotals.views) * 100
        : 0;
    const previousWeekCTR = previousWeekTotals.views > 0
        ? (previousWeekTotals.clicks / previousWeekTotals.views) * 100
        : 0;

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

export async function getAnalyticsTotals(shop) {
    const totals = await prisma.analytics.aggregate({
        where: { shop },
        _sum: {
            views: true,
            clicks: true,
        },
    });

    const views = totals._sum.views || 0;
    const clicks = totals._sum.clicks || 0;
    const ctr = views > 0 ? (clicks / views) * 100 : 0;

    return {
        views,
        clicks,
        ctr: ctr.toFixed(2),
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

export async function resetAnalyticsForShop(shop) {
    await prisma.$transaction([
        prisma.analytics.deleteMany({ where: { shop } }),
        prisma.postAnalytics.deleteMany({ where: { shop } }),
    ]);
}
