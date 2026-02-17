import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    Text,
    BlockStack,
    InlineStack,
    Box,
    Grid,
    Divider,
    IndexTable,
    Badge,
    Icon,
    EmptyState,
    Button,
    Banner,
} from "@shopify/polaris";
import {
    ViewIcon,
    ArrowRightIcon,
    ChartVerticalIcon,
    CalendarIcon
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getAnalytics, getAnalyticsTotals, getTopPostsAnalytics } from "../models/analytics.server";
import { isPremiumShop } from "../utils/premium.server";

function createEmptyAnalytics() {
    return {
        dailyStats: [
            { date: new Date().toISOString().split('T')[0], views: 0, clicks: 0 }
        ],
        totals: {
            views: 0,
            clicks: 0,
            ctr: "0.00"
        },
        weekOverWeek: {
            views: 0,
            clicks: 0,
            ctr: 0,
            engagement: 0
        }
    };
}

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const { shop } = session;
    const premium = await isPremiumShop(shop);

    const [allTimeTotals, weeklyAnalytics] = await Promise.all([
        getAnalyticsTotals(shop),
        getAnalytics(shop, 7),
    ]);

    const hasRealData = (allTimeTotals.views + allTimeTotals.clicks) > 0;
    const displayWeeklyAnalytics = hasRealData ? weeklyAnalytics : createEmptyAnalytics();

    let detailedRanges = null;
    let topPosts = null;

    if (premium) {
        const [range30, range60, range90, topPostsData] = await Promise.all([
            getAnalytics(shop, 30),
            getAnalytics(shop, 60),
            getAnalytics(shop, 90),
            getTopPostsAnalytics(shop),
        ]);

        detailedRanges = {
            30: range30,
            60: range60,
            90: range90,
        };
        topPosts = topPostsData.length > 0 ? topPostsData : null;
    }

    return json({
        allTimeTotals,
        weeklyAnalytics: displayWeeklyAnalytics,
        detailedRanges,
        topPosts,
        isPremium: premium,
        shop,
        hasRealData
    });
};

export default function AnalyticsPage() {
    const {
        allTimeTotals,
        weeklyAnalytics,
        detailedRanges,
        topPosts,
        isPremium,
    } = useLoaderData();

    const resourceName = {
        singular: 'post',
        plural: 'posts',
    };

    // Helper function to format percentage change badge
    const formatChangeBadge = (change) => {
        const roundedChange = Math.round(change * 10) / 10; // Round to 1 decimal

        if (Math.abs(roundedChange) < 0.5) {
            return {
                text: 'Stable',
                tone: 'attention'
            };
        }

        const sign = roundedChange > 0 ? '+' : '';
        return {
            text: `${sign}${roundedChange.toFixed(1)}% from last week`,
            tone: roundedChange > 0 ? 'success' : 'critical'
        };
    };

    // Prepare last 7 days data for insights chart
    const getLast7DaysData = () => {
        const days = [];
        const now = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(now.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const dateStr = date.toISOString().split('T')[0];
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

            const dayData = weeklyAnalytics.dailyStats.find(stat => {
                const statDate = new Date(stat.date).toISOString().split('T')[0];
                return statDate === dateStr;
            });

            days.push({
                day: dayName,
                date: dateStr,
                views: dayData?.views || 0,
                clicks: dayData?.clicks || 0,
                total: (dayData?.views || 0) + (dayData?.clicks || 0)
            });
        }

        return days;
    };

    const last7Days = getLast7DaysData();
    const maxEngagement = Math.max(...last7Days.map(d => d.total), 1);

    // Calculate performance summary stats
    const bestDay = last7Days.reduce((best, current) =>
        current.total > best.total ? current : best
    , last7Days[0]);

    const avgDailyViews = Math.round(last7Days.reduce((sum, day) => sum + day.views, 0) / 7);
    const avgDailyClicks = Math.round(last7Days.reduce((sum, day) => sum + day.clicks, 0) / 7);
    const totalEngagement = last7Days.reduce((sum, day) => sum + day.total, 0);

    return (
        <Page title="Analytics">
            <Layout>
                {/* Metric Overviews */}
                <Layout.Section>
                    <Grid>
                        <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
                            <Card padding="400">
                                <BlockStack gap="200">
                                    <InlineStack gap="100" blockAlign="center">
                                        <Text variant="headingSm" as="h6" tone="subdued">Total Views</Text>
                                        <div style={{ marginLeft: '0px', display: 'flex' }}>
                                            <Icon source={ViewIcon} tone="base" />
                                        </div>
                                    </InlineStack>
                                    <Text variant="headingLg" as="p">{allTimeTotals.views.toLocaleString()}</Text>
                                    {isPremium && (
                                        <Badge tone={formatChangeBadge(weeklyAnalytics.weekOverWeek.views).tone}>
                                            {formatChangeBadge(weeklyAnalytics.weekOverWeek.views).text}
                                        </Badge>
                                    )}
                                </BlockStack>
                            </Card>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
                            <Card padding="400">
                                <BlockStack gap="200">
                                    <InlineStack gap="100" blockAlign="center">
                                        <Text variant="headingSm" as="h6" tone="subdued">Total Clicks</Text>
                                        <div style={{ marginLeft: '0px', display: 'flex' }}>
                                            <Icon source={ArrowRightIcon} tone="base" />
                                        </div>
                                    </InlineStack>
                                    <Text variant="headingLg" as="p">{allTimeTotals.clicks.toLocaleString()}</Text>
                                    {isPremium && (
                                        <Badge tone={formatChangeBadge(weeklyAnalytics.weekOverWeek.clicks).tone}>
                                            {formatChangeBadge(weeklyAnalytics.weekOverWeek.clicks).text}
                                        </Badge>
                                    )}
                                </BlockStack>
                            </Card>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
                            <Card padding="400">
                                <BlockStack gap="200">
                                    <InlineStack gap="100" blockAlign="center">
                                        <Text variant="headingSm" as="h6" tone="subdued">Click-through Rate</Text>
                                        <div style={{ marginLeft: '0px', display: 'flex' }}>
                                            <Icon source={ChartVerticalIcon} tone="base" />
                                        </div>
                                    </InlineStack>
                                    <Text variant="headingLg" as="p">{allTimeTotals.ctr}%</Text>
                                    {isPremium && (
                                        <Badge tone={formatChangeBadge(weeklyAnalytics.weekOverWeek.ctr).tone}>
                                            {formatChangeBadge(weeklyAnalytics.weekOverWeek.ctr).text}
                                        </Badge>
                                    )}
                                </BlockStack>
                            </Card>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
                            <Card padding="400">
                                <BlockStack gap="200">
                                    <InlineStack gap="100" blockAlign="center">
                                        <Text variant="headingSm" as="h6" tone="subdued">Total Engagement</Text>
                                        <div style={{ marginLeft: '0px', display: 'flex' }}>
                                            <Icon source={CalendarIcon} tone="base" />
                                        </div>
                                    </InlineStack>
                                    <Text variant="headingLg" as="p">{(allTimeTotals.views + allTimeTotals.clicks).toLocaleString()}</Text>
                                    {isPremium && (
                                        <Badge tone={formatChangeBadge(weeklyAnalytics.weekOverWeek.engagement).tone}>
                                            {formatChangeBadge(weeklyAnalytics.weekOverWeek.engagement).text}
                                        </Badge>
                                    )}
                                </BlockStack>
                            </Card>
                        </Grid.Cell>
                    </Grid>
                </Layout.Section>

                {!isPremium && (
                    <Layout.Section>
                        <Banner
                            tone="info"
                            title="Basic plan active"
                            action={{ content: "Upgrade Plan", url: "/app/plans" }}
                        >
                            <p>Basic plan includes all-time totals and last 7 days analysis. Upgrade to unlock 30/60/90-day insights and top performing posts.</p>
                        </Banner>
                    </Layout.Section>
                )}

                {isPremium && detailedRanges && (
                    <Layout.Section>
                        <Card>
                            <Box padding="400">
                                <BlockStack gap="300">
                                    <Text variant="headingMd" as="h3">Detailed Period Insights</Text>
                                    <Grid>
                                        {[30, 60, 90].map((days) => {
                                            const range = detailedRanges[days];
                                            const views = range?.totals.views || 0;
                                            const clicks = range?.totals.clicks || 0;
                                            const ctr = range?.totals.ctr || "0.00";
                                            const engagement = views + clicks;

                                            return (
                                                <Grid.Cell key={days} columnSpan={{ xs: 6, sm: 3, md: 4, lg: 4, xl: 4 }}>
                                                    <Card padding="400">
                                                        <BlockStack gap="300">
                                                            <InlineStack align="space-between" blockAlign="center">
                                                                <Text variant="headingSm" as="h4">{days} Days</Text>
                                                                <Badge tone="info">Period</Badge>
                                                            </InlineStack>

                                                            <BlockStack gap="200">
                                                                <InlineStack align="space-between">
                                                                    <Text variant="bodySm" as="span" tone="subdued">Views</Text>
                                                                    <Text variant="bodyMd" as="span">{views.toLocaleString()}</Text>
                                                                </InlineStack>
                                                                <InlineStack align="space-between">
                                                                    <Text variant="bodySm" as="span" tone="subdued">Clicks</Text>
                                                                    <Text variant="bodyMd" as="span">{clicks.toLocaleString()}</Text>
                                                                </InlineStack>
                                                                <InlineStack align="space-between">
                                                                    <Text variant="bodySm" as="span" tone="subdued">CTR</Text>
                                                                    <Text variant="bodyMd" as="span">{ctr}%</Text>
                                                                </InlineStack>
                                                            </BlockStack>

                                                            <Box
                                                                padding="250"
                                                                borderRadius="200"
                                                                background="bg-surface-secondary"
                                                            >
                                                                <InlineStack align="space-between" blockAlign="center">
                                                                    <Text variant="bodySm" as="span" tone="subdued">Total interactions</Text>
                                                                    <Text variant="headingSm" as="span">{engagement.toLocaleString()}</Text>
                                                                </InlineStack>
                                                            </Box>
                                                        </BlockStack>
                                                    </Card>
                                                </Grid.Cell>
                                            );
                                        })}
                                    </Grid>
                                </BlockStack>
                            </Box>
                        </Card>
                    </Layout.Section>
                )}

                {/* Main Content Areas */}
                <Layout.Section>
                    <Grid>
                        {/* Performance Chart */}
                        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 8, lg: 8, xl: 8 }}>
                            <Card padding="400">
                                <BlockStack gap="400">
                                    <InlineStack align="space-between" blockAlign="center">
                                        <Text variant="headingMd" as="h3">Last 7 Days Activity</Text>
                                        <Badge tone="info">{totalEngagement} total interactions</Badge>
                                    </InlineStack>
                                    <Box padding="600" background="bg-surface-secondary" borderRadius="200">
                                        <BlockStack gap="600">
                                            <InlineStack align="space-between" blockAlign="end">
                                                {last7Days.map((dayData, i) => {
                                                    const barHeight = maxEngagement > 0
                                                        ? Math.max((dayData.total / maxEngagement) * 120, 10)
                                                        : 10;
                                                    const isToday = i === 6;

                                                    return (
                                                        <div
                                                            key={i}
                                                            style={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                position: 'relative'
                                                            }}
                                                        >
                                                            <div style={{
                                                                fontSize: '10px',
                                                                color: '#6d7175',
                                                                fontWeight: isToday ? 'bold' : 'normal'
                                                            }}>
                                                                {dayData.total}
                                                            </div>
                                                            <div style={{
                                                                height: `${barHeight}px`,
                                                                width: '35px',
                                                                background: isToday ? '#008060' : '#c1e0d7',
                                                                borderRadius: '4px 4px 0 0',
                                                                position: 'relative',
                                                                cursor: 'pointer',
                                                                transition: 'opacity 0.2s'
                                                            }}
                                                                title={`${dayData.day}: ${dayData.views} views, ${dayData.clicks} clicks`}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </InlineStack>
                                            <InlineStack align="space-between">
                                                {last7Days.map((dayData, i) => (
                                                    <Text key={i} variant="bodySm" tone="subdued" fontWeight={i === 6 ? "bold" : "regular"}>
                                                        {dayData.day}
                                                    </Text>
                                                ))}
                                            </InlineStack>
                                        </BlockStack>
                                    </Box>
                                    <InlineStack gap="400" wrap>
                                        <InlineStack gap="100" blockAlign="center">
                                            <div style={{ width: '12px', height: '12px', background: '#c1e0d7', borderRadius: '2px' }} />
                                            <Text variant="bodySm" tone="subdued">Previous days</Text>
                                        </InlineStack>
                                        <InlineStack gap="100" blockAlign="center">
                                            <div style={{ width: '12px', height: '12px', background: '#008060', borderRadius: '2px' }} />
                                            <Text variant="bodySm" tone="subdued">Today</Text>
                                        </InlineStack>
                                    </InlineStack>
                                </BlockStack>
                            </Card>
                        </Grid.Cell>

                        {/* Summary Info */}
                        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
                            <Card>
                                <Box padding="400">
                                    <BlockStack gap="400">
                                        <Text variant="headingMd" as="h3">Weekly Summary</Text>
                                        <Divider />
                                        <BlockStack gap="300">
                                            <InlineStack align="space-between">
                                                <Text variant="bodyMd" as="span" tone="subdued">Best Day</Text>
                                                <Badge tone="success">{bestDay.day}</Badge>
                                            </InlineStack>
                                            <Text variant="bodySm" tone="subdued">
                                                {bestDay.total} interactions on {bestDay.day}
                                            </Text>
                                        </BlockStack>
                                        <Divider />
                                        <BlockStack gap="300">
                                            <InlineStack align="space-between">
                                                <Text variant="bodyMd" as="span" tone="subdued">Avg Daily Views</Text>
                                                <Text variant="bodyMd" as="span" fontWeight="bold">{avgDailyViews}</Text>
                                            </InlineStack>
                                            <InlineStack align="space-between">
                                                <Text variant="bodyMd" as="span" tone="subdued">Avg Daily Clicks</Text>
                                                <Text variant="bodyMd" as="span" fontWeight="bold">{avgDailyClicks}</Text>
                                            </InlineStack>
                                        </BlockStack>
                                        <Divider />
                                        <Text variant="bodySm" tone="subdued">
                                            {totalEngagement > 0
                                                ? `Your feed received ${totalEngagement} total interactions this week.`
                                                : 'No interactions yet. Share your feed to start collecting data!'
                                            }
                                        </Text>
                                    </BlockStack>
                                </Box>
                            </Card>
                        </Grid.Cell>
                    </Grid>
                </Layout.Section>

                {/* Top Performing Posts */}
                {isPremium && (
                    <Layout.Section>
                        <Card padding="0">
                            <Box padding="400">
                                <Text variant="headingMd" as="h3">Top Performing Posts</Text>
                            </Box>
                            {topPosts ? (
                                <IndexTable
                                    resourceName={resourceName}
                                    itemCount={topPosts.length}
                                    headings={[
                                        { title: 'Post' },
                                        { title: 'Media ID' },
                                        { title: 'Views' },
                                        { title: 'Clicks' },
                                        { title: 'CTR' },
                                        { title: 'Link', alignment: 'end' },
                                    ]}
                                    selectable={false}
                                >
                                    {topPosts.map((post, index) => (
                                        <IndexTable.Row id={post.id} key={post.id} position={index}>
                                            <IndexTable.Cell>
                                                <div style={{ padding: '8px 0' }}>
                                                    {post.mediaUrl ? (
                                                        <img
                                                            src={post.mediaUrl}
                                                            alt="Post preview"
                                                            style={{
                                                                width: '40px',
                                                                height: '40px',
                                                                objectFit: 'cover',
                                                                borderRadius: '4px',
                                                                border: '1px solid #e1e3e5'
                                                            }}
                                                        />
                                                    ) : (
                                                        <div style={{
                                                            width: '40px',
                                                            height: '40px',
                                                            background: '#f1f1f1',
                                                            borderRadius: '4px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            <Icon source={ViewIcon} tone="subdued" />
                                                        </div>
                                                    )}
                                                </div>
                                            </IndexTable.Cell>
                                            <IndexTable.Cell>
                                                <Text variant="bodyMd" tone="subdued" as="span">
                                                    {post.mediaId}
                                                </Text>
                                            </IndexTable.Cell>
                                            <IndexTable.Cell>
                                                <Text variant="bodyMd" as="span" fontWeight="medium">
                                                    {post.views.toLocaleString()}
                                                </Text>
                                            </IndexTable.Cell>
                                            <IndexTable.Cell>
                                                <Text variant="bodyMd" as="span" fontWeight="medium">
                                                    {post.clicks.toLocaleString()}
                                                </Text>
                                            </IndexTable.Cell>
                                            <IndexTable.Cell>
                                                <Badge tone={parseFloat(((post.clicks / post.views) * 100).toFixed(2)) > 15 ? 'success' : 'info'}>
                                                    {post.views > 0 ? ((post.clicks / post.views) * 100).toFixed(2) : '0.00'}%
                                                </Badge>
                                            </IndexTable.Cell>
                                            <IndexTable.Cell>
                                                <div style={{ textAlign: 'right' }}>
                                                    <Button
                                                        variant="tertiary"
                                                        icon={ArrowRightIcon}
                                                        url={post.permalink || '#'}
                                                        external
                                                    >
                                                        View
                                                    </Button>
                                                </div>
                                            </IndexTable.Cell>
                                        </IndexTable.Row>
                                    ))}
                                </IndexTable>
                            ) : (
                                <Box padding="800">
                                    <EmptyState
                                        heading="No post performance data yet"
                                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/empty-state-cards_large.png"
                                    >
                                        <p>Once users start interacting with your Instagram feed, detailed post-level analytics will appear here.</p>
                                    </EmptyState>
                                </Box>
                            )}
                        </Card>
                    </Layout.Section>
                )}
            </Layout>
            <Box paddingBlockEnd="800" />
        </Page>
    );
}
