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
} from "@shopify/polaris";
import {
    ViewIcon,
    ArrowRightIcon,
    ChartVerticalIcon,
    CalendarIcon
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getAnalytics, getTopPostsAnalytics } from "../models/analytics.server";

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const { shop } = session;

    const analytics = await getAnalytics(shop);
    const topPosts = await getTopPostsAnalytics(shop);

    const hasRealData = analytics.dailyStats.length > 0;

    // Use zeroed stats if no real data exists
    const displayAnalytics = hasRealData ? analytics : {
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

    return json({
        analytics: displayAnalytics,
        topPosts: topPosts.length > 0 ? topPosts : null,
        shop,
        hasRealData
    });
};

export default function AnalyticsPage() {
    const { analytics, topPosts } = useLoaderData();

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
                                    <Text variant="headingLg" as="p">{analytics.totals.views.toLocaleString()}</Text>
                                    <Badge tone={formatChangeBadge(analytics.weekOverWeek.views).tone}>
                                        {formatChangeBadge(analytics.weekOverWeek.views).text}
                                    </Badge>
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
                                    <Text variant="headingLg" as="p">{analytics.totals.clicks.toLocaleString()}</Text>
                                    <Badge tone={formatChangeBadge(analytics.weekOverWeek.clicks).tone}>
                                        {formatChangeBadge(analytics.weekOverWeek.clicks).text}
                                    </Badge>
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
                                    <Text variant="headingLg" as="p">{analytics.totals.ctr}%</Text>
                                    <Badge tone={formatChangeBadge(analytics.weekOverWeek.ctr).tone}>
                                        {formatChangeBadge(analytics.weekOverWeek.ctr).text}
                                    </Badge>
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
                                    <Text variant="headingLg" as="p">{(analytics.totals.views + analytics.totals.clicks).toLocaleString()}</Text>
                                    <Badge tone={formatChangeBadge(analytics.weekOverWeek.engagement).tone}>
                                        {formatChangeBadge(analytics.weekOverWeek.engagement).text}
                                    </Badge>
                                </BlockStack>
                            </Card>
                        </Grid.Cell>
                    </Grid>
                </Layout.Section>

                {/* Main Content Areas */}
                <Layout.Section>
                    <Grid>
                        {/* Performance Chart Placeholder */}
                        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 8, lg: 8, xl: 8 }}>
                            <Card padding="400">
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h3">Insights</Text>
                                    <Box padding="600" background="bg-surface-secondary" borderRadius="200">
                                        <BlockStack gap="600">
                                            <InlineStack align="space-between" blockAlign="end">
                                                {[40, 60, 45, 90, 65, 80, 100].map((height, i) => (
                                                    <div key={i} style={{
                                                        height: `${height}px`,
                                                        width: '30px',
                                                        background: i === 6 ? '#008060' : '#c1e0d7',
                                                        borderRadius: '4px 4px 0 0'
                                                    }} />
                                                ))}
                                            </InlineStack>
                                            <InlineStack align="space-between">
                                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                                    <Text key={day} variant="bodySm" tone="subdued">{day}</Text>
                                                ))}
                                            </InlineStack>
                                        </BlockStack>
                                    </Box>
                                </BlockStack>
                            </Card>
                        </Grid.Cell>

                        {/* Summary Info */}
                        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
                            <Card title="Summary Breakdown">
                                <Box padding="400">
                                    <BlockStack gap="400">
                                        <Text variant="headingMd" as="h3">Performance Summary</Text>
                                        <Divider />
                                        <InlineStack align="space-between">
                                            <Text variant="bodyMd" as="span">Desktop Views</Text>
                                            <Text variant="bodyMd" as="span" fontWeight="bold">84%</Text>
                                        </InlineStack>
                                        <InlineStack align="space-between">
                                            <Text variant="bodyMd" as="span">Mobile Views</Text>
                                            <Text variant="bodyMd" as="span" fontWeight="bold">16%</Text>
                                        </InlineStack>
                                        <Divider />
                                        <Text variant="bodySm" tone="subdued">Most interactions happen on desktop layouts during working hours.</Text>
                                    </BlockStack>
                                </Box>
                            </Card>
                        </Grid.Cell>
                    </Grid>
                </Layout.Section>

                {/* Top Performing Posts */}
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
            </Layout>
            <Box paddingBlockEnd="800" />
        </Page>
    );
}
