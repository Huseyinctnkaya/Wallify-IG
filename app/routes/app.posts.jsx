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
    Button,
    Badge,
    Banner,
    Icon,
} from "@shopify/polaris";
import {
    PinIcon,
    HideIcon,
    PlusIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getInstagramAccount, fetchInstagramMedia } from "../models/instagram.server";
import { getSettings } from "../models/settings.server";

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const { shop } = session;

    const settings = await getSettings(shop);
    const instagramAccount = await getInstagramAccount(shop);
    let posts = [];

    if (instagramAccount) {
        try {
            const media = await fetchInstagramMedia(instagramAccount.userId, instagramAccount.accessToken, settings.mediaLimit);
            posts = media.map(item => ({
                id: item.id,
                date: new Date(item.timestamp).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric'
                }).replace(/,/g, ''),
                mediaUrl: item.thumbnail_url || item.media_url,
                permalink: item.permalink,
                isPinned: false,
                isHidden: false,
                products: []
            })).slice(0, settings.mediaLimit);
        } catch (error) {
            console.error("Failed to fetch media for management page:", error);
        }
    }

    // Fallback mock data if no real data exists
    if (posts.length === 0) {
        const mockPosts = [
            {
                id: '1',
                date: 'Tue Feb 10 2026',
                mediaUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=400&auto=format&fit=crop',
                isPinned: false,
                isHidden: false,
                products: []
            },
            {
                id: '2',
                date: 'Fri Jan 23 2026',
                mediaUrl: 'https://images.unsplash.com/photo-1529139572764-7ff73077af4c?q=80&w=400&auto=format&fit=crop',
                isPinned: false,
                isHidden: false,
                products: []
            },
            {
                id: '3',
                date: 'Fri Jan 09 2026',
                mediaUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=400&auto=format&fit=crop',
                isPinned: false,
                isHidden: false,
                products: []
            },
            {
                id: '4',
                date: 'Wed Jan 07 2026',
                mediaUrl: 'https://images.unsplash.com/photo-1511130523564-071a9426f030?q=80&w=400&auto=format&fit=crop',
                isPinned: false,
                isHidden: false,
                products: []
            },
            {
                id: '5',
                date: 'Mon Jan 05 2026',
                mediaUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
                isPinned: false,
                isHidden: false,
                products: []
            },
            {
                id: '6',
                date: 'Sun Jan 04 2026',
                mediaUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=400&auto=format&fit=crop',
                isPinned: false,
                isHidden: false,
                products: []
            }
        ];
        // Slice mock data based on settings.mediaLimit
        posts = mockPosts.slice(0, settings.mediaLimit);
    }

    return json({
        posts,
        isPremium: false,
    });
};

const ProBadge = () => (
    <Badge tone="info" size="small">Pro</Badge>
);

const PostCard = ({ post }) => (
    <Card padding="0">
        <Box padding="300">
            <BlockStack gap="300">
                <InlineStack align="space-between">
                    <InlineStack gap="200">
                        <Button size="slim" icon={PinIcon}>
                            <InlineStack gap="100">
                                <Text variant="bodySm" as="span">Pin</Text>
                                <ProBadge />
                            </InlineStack>
                        </Button>
                        <Button size="slim" icon={HideIcon}>
                            <InlineStack gap="100">
                                <Text variant="bodySm" as="span">Hide</Text>
                                <ProBadge />
                            </InlineStack>
                        </Button>
                    </InlineStack>
                </InlineStack>

                <Text variant="bodyMd" fontWeight="bold" tone="subdued">
                    {post.date}
                </Text>

                <div style={{
                    width: '100%',
                    aspectRatio: '1/1',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    background: '#f1f1f1'
                }}>
                    <img
                        src={post.mediaUrl}
                        alt="Instagram post"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                </div>

                <BlockStack gap="100">
                    <Text variant="headingSm" as="h6">Attached products</Text>
                    <Text variant="bodyMd" tone="subdued">No products attached</Text>
                </BlockStack>

                <InlineStack align="end">
                    <Button variant="tertiary" size="slim">
                        <InlineStack gap="100">
                            <Text variant="bodySm" as="span">Edit products</Text>
                            <ProBadge />
                        </InlineStack>
                    </Button>
                </InlineStack>
            </BlockStack>
        </Box>
    </Card>
);

export default function PostsPage() {
    const { posts, isPremium } = useLoaderData();

    return (
        <Page
            title="Videos"
            primaryAction={{ content: 'Import video by URL', variant: 'primary' }}
        >
            <Layout>
                {!isPremium && (
                    <Layout.Section>
                        <Banner
                            title="You're on the free plan"
                            tone="warning"
                            action={{ content: 'Upgrade' }}
                        >
                            <p>Features on this page like pinning reels, hiding reels, and attaching products are part of the premium plan!</p>
                        </Banner>
                    </Layout.Section>
                )}

                <Layout.Section>
                    <Grid>
                        {posts.map((post) => (
                            <Grid.Cell key={post.id} columnSpan={{ xs: 6, sm: 3, md: 4, lg: 4, xl: 4 }}>
                                <PostCard post={post} />
                            </Grid.Cell>
                        ))}
                    </Grid>
                </Layout.Section>
            </Layout>
            <Box paddingBlockEnd="800" />
        </Page>
    );
}
