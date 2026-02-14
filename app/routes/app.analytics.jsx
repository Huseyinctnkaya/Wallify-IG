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

    // Mock data for initial view if no real data exists
    const mockDailyStats = [
        { date: '2026-02-08', views: 120, clicks: 12 },
        { date: '2026-02-09', views: 150, clicks: 18 },
        { date: '2026-02-10', views: 180, clicks: 25 },
        { date: '2026-02-11', views: 210, clicks: 30 },
        { date: '2026-02-12', views: 190, clicks: 22 },
        { date: '2026-02-13', views: 250, clicks: 45 },
        { date: '2026-02-14', views: 300, clicks: 64 },
    ];

    const mockTopPosts = [
        {
            id: '1',
            mediaId: '17841401234567890',
            mediaUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=100&auto=format&fit=crop',
            permalink: 'https://instagram.com',
            views: 1250,
            clicks: 185
        },
        {
            id: '2',
            mediaId: '17841409876543210',
            mediaUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=100&auto=format&fit=crop',
            permalink: 'https://instagram.com',
            views: 980,
            clicks: 142
        },
        {
            id: '3',
            mediaId: '17841405556667778',
            mediaUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=100&auto=format&fit=crop',
            permalink: 'https://instagram.com',
            views: 850,
            clicks: 110
        },
        {
            id: '4',
            mediaId: '17841401112223334',
            mediaUrl: 'https://images.unsplash.com/photo-1526170315870-efffd0ad46b4?q=80&w=100&auto=format&fit=crop',
            permalink: 'https://instagram.com',
            views: 720,
            clicks: 95
        },
        {
            id: '5',
            mediaId: '17841409998887776',
            mediaUrl: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?q=80&w=100&auto=format&fit=crop',
            permalink: 'https://instagram.com',
            views: 600,
            clicks: 58
        },
    ];

    const displayAnalytics = analytics.dailyStats.length > 0 ? analytics : {
        dailyStats: mockDailyStats,
        totals: {
            views: 1400,
            clicks: 216,
            ctr: "15.43"
        }
    };

    return json({
        analytics: displayAnalytics,
        topPosts: topPosts.length > 0 ? topPosts : mockTopPosts,
        shop
    });
};

export default function AnalyticsPage() {
    const { analytics, topPosts } = useLoaderData();

    const resourceName = {
        singular: 'post',
        plural: 'posts',
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
                                    <Badge tone="success">+12% from last week</Badge>
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
                                    <Badge tone="success">+8% from last week</Badge>
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
                                    <Badge tone="attention">Stable</Badge>
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
                                    <Badge tone="success">+15%</Badge>
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
