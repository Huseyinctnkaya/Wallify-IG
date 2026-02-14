import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState } from "react";
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
} from "@shopify/polaris-icons";
import { Modal } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getInstagramAccount, fetchInstagramMedia, syncInstagramToMetafields } from "../models/instagram.server";
import { getSettings } from "../models/settings.server";
import { getPosts, togglePin, toggleHide, updateProducts } from "../models/post.server";
import { isPremiumShop } from "../utils/premium.server";

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const { shop } = session;

    const settings = await getSettings(shop);
    const instagramAccount = await getInstagramAccount(shop);
    const isPremium = await isPremiumShop(shop);
    let posts = [];

    if (instagramAccount) {
        try {
            // Fetch Instagram media
            const media = await fetchInstagramMedia(instagramAccount.userId, instagramAccount.accessToken, settings.mediaLimit);

            // Fetch Post records from database
            const postRecords = await getPosts(shop);

            // Merge Instagram data with Post metadata
            posts = media.map(item => {
                const record = postRecords.find(p => p.mediaId === item.id);

                return {
                    id: item.id,
                    date: new Date(item.timestamp).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric'
                    }).replace(/,/g, ''),
                    mediaUrl: item.thumbnail_url || item.media_url,
                    permalink: item.permalink,
                    mediaType: item.media_type,
                    caption: item.caption || '',
                    // Merge Post metadata
                    isPinned: record?.isPinned || false,
                    isHidden: record?.isHidden || false,
                    products: record?.products ? JSON.parse(record.products) : []
                };
            }).slice(0, settings.mediaLimit);

            // Note: showPinnedReels filter is NOT applied on management page
            // It only affects the storefront (theme) display
            // Here we show ALL posts so users can manage them
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
        isPremium,
    });
};

export async function action({ request }) {
    const { session, admin } = await authenticate.admin(request);
    const { shop } = session;
    const formData = await request.formData();
    const actionType = formData.get("actionType");

    // Check premium status
    const isPremium = await isPremiumShop(shop);

    // Premium feature gate
    if (!isPremium && ["togglePin", "toggleHide", "updateProducts"].includes(actionType)) {
        return json({
            error: "This is a premium feature. Upgrade to unlock pin, hide, and product attachment features.",
            showUpgrade: true
        }, { status: 403 });
    }

    try {
        if (actionType === "togglePin") {
            const mediaId = formData.get("mediaId");
            await togglePin(shop, mediaId);

            // Trigger metafield sync to update theme
            await syncInstagramToMetafields(shop, admin);

            return json({ success: true, message: "Post pin status updated" });
        }

        if (actionType === "toggleHide") {
            const mediaId = formData.get("mediaId");
            await toggleHide(shop, mediaId);

            // Trigger metafield sync to update theme
            await syncInstagramToMetafields(shop, admin);

            return json({ success: true, message: "Post hide status updated" });
        }

        if (actionType === "updateProducts") {
            const mediaId = formData.get("mediaId");
            const productsData = formData.get("products");
            const products = productsData ? JSON.parse(productsData) : [];

            await updateProducts(shop, mediaId, products);

            // Trigger metafield sync to update theme
            await syncInstagramToMetafields(shop, admin);

            return json({ success: true, message: "Products updated successfully" });
        }

        return json({ error: "Unknown action type" }, { status: 400 });
    } catch (error) {
        console.error("Action error:", error);
        return json({ error: error.message || "An error occurred" }, { status: 500 });
    }
}

const ProBadge = () => (
    <Badge tone="info" size="small">Pro</Badge>
);

const PostCard = ({ post, isPremium, onEditProducts, onShowUpgrade }) => {
    const fetcher = useFetcher();
    const isLoading = fetcher.state === "submitting";

    const handleTogglePin = () => {
        if (!isPremium) {
            onShowUpgrade();
            return;
        }
        fetcher.submit(
            { actionType: "togglePin", mediaId: post.id },
            { method: "post" }
        );
    };

    const handleToggleHide = () => {
        if (!isPremium) {
            onShowUpgrade();
            return;
        }
        fetcher.submit(
            { actionType: "toggleHide", mediaId: post.id },
            { method: "post" }
        );
    };

    const handleEditProducts = () => {
        if (!isPremium) {
            onShowUpgrade();
            return;
        }
        onEditProducts(post);
    };

    return (
        <Card padding="0">
            <Box padding="300">
                <BlockStack gap="300">
                    <InlineStack align="space-between">
                        <InlineStack gap="200">
                            <Button
                                size="slim"
                                onClick={handleTogglePin}
                                disabled={!isPremium || isLoading}
                                pressed={post.isPinned}
                            >
                                <InlineStack gap="150" blockAlign="center">
                                    <Icon source={PinIcon} />
                                    <Text variant="bodySm" as="span">
                                        {post.isPinned ? "Unpin" : "Pin"}
                                    </Text>
                                    {!isPremium && <ProBadge />}
                                </InlineStack>
                            </Button>
                            <Button
                                size="slim"
                                onClick={handleToggleHide}
                                disabled={!isPremium || isLoading}
                                tone={post.isHidden ? "critical" : undefined}
                            >
                                <InlineStack gap="150" blockAlign="center">
                                    <Icon source={HideIcon} />
                                    <Text variant="bodySm" as="span">
                                        {post.isHidden ? "Unhide" : "Hide"}
                                    </Text>
                                    {!isPremium && <ProBadge />}
                                </InlineStack>
                            </Button>
                        </InlineStack>
                    </InlineStack>

                    {post.isPinned && (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <Banner tone="info">
                                <Text variant="bodySm">This post is pinned</Text>
                            </Banner>
                        </div>
                    )}

                    {post.isHidden && (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <Banner tone="warning">
                                <Text variant="bodySm">This post is hidden from your storefront</Text>
                            </Banner>
                        </div>
                    )}

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
                        {post.products && post.products.length > 0 ? (
                            <InlineStack gap="100" wrap>
                                {post.products.map((product, index) => (
                                    <Badge key={index} tone="success">
                                        {product.title}
                                    </Badge>
                                ))}
                            </InlineStack>
                        ) : (
                            <Text variant="bodyMd" tone="subdued">No products attached</Text>
                        )}
                    </BlockStack>

                    <InlineStack align="start">
                        <Button
                            size="slim"
                            onClick={handleEditProducts}
                            disabled={!isPremium || isLoading}
                        >
                            <InlineStack gap="150" blockAlign="center">
                                <Text variant="bodySm" as="span">Edit products</Text>
                                {!isPremium && <ProBadge />}
                            </InlineStack>
                        </Button>
                    </InlineStack>

                    {fetcher.data?.success && (
                        <Banner tone="success">
                            <Text variant="bodySm">{fetcher.data.message}</Text>
                        </Banner>
                    )}

                    {fetcher.data?.error && (
                        <Banner tone="critical">
                            <Text variant="bodySm">{fetcher.data.error}</Text>
                        </Banner>
                    )}
                </BlockStack>
            </Box>
        </Card>
    );
};

export default function PostsPage() {
    const { posts, isPremium } = useLoaderData();
    const fetcher = useFetcher();

    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const handleEditProducts = (post) => {
        if (!isPremium) {
            setShowUpgradeModal(true);
            return;
        }

        // Open Shopify product selector
        const productSelector = window.shopify?.resourcePicker || null;

        if (productSelector) {
            productSelector({
                type: 'product',
                multiple: true,
                action: 'select',
            }).then((selection) => {
                if (selection && selection.length > 0) {
                    const products = selection.map(product => ({
                        id: product.id,
                        title: product.title,
                        handle: product.handle,
                        image: product.images?.[0]?.src || null
                    }));

                    fetcher.submit(
                        {
                            actionType: "updateProducts",
                            mediaId: post.id,
                            products: JSON.stringify(products)
                        },
                        { method: "post" }
                    );
                }
            }).catch((error) => {
                console.error("Product selection error:", error);
            });
        } else {
            // Fallback: Show a message to add products manually
            alert("Product picker is not available. Please ensure you're running in Shopify admin.");
        }
    };

    const handleShowUpgrade = () => {
        setShowUpgradeModal(true);
    };

    return (
        <Page
            title="Posts & Reels"
            subtitle="Manage your Instagram posts and reels"
        >
            <Layout>
                {!isPremium && (
                    <Layout.Section>
                        <Banner
                            title="You're on the free plan"
                            tone="warning"
                            action={{
                                content: 'Upgrade to Premium',
                                url: '/app/plans'
                            }}
                        >
                            <p>Features on this page like pinning posts, hiding posts, and attaching products are part of the premium plan!</p>
                        </Banner>
                    </Layout.Section>
                )}

                <Layout.Section>
                    <Grid>
                        {posts.map((post) => (
                            <Grid.Cell key={post.id} columnSpan={{ xs: 6, sm: 3, md: 4, lg: 4, xl: 4 }}>
                                <PostCard
                                    post={post}
                                    isPremium={isPremium}
                                    onEditProducts={handleEditProducts}
                                    onShowUpgrade={handleShowUpgrade}
                                />
                            </Grid.Cell>
                        ))}
                    </Grid>
                </Layout.Section>
            </Layout>
            <Box paddingBlockEnd="800" />

            {/* Upgrade Modal */}
            {showUpgradeModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <Card>
                        <Box padding="400">
                            <BlockStack gap="400">
                                <Text variant="headingMd" as="h2">Upgrade to Premium</Text>
                                <Text variant="bodyMd">
                                    Pin posts, hide posts, and attach products are premium features.
                                    Upgrade now to unlock these powerful features and grow your sales!
                                </Text>
                                <InlineStack gap="200">
                                    <Button variant="primary" url="/app/plans">
                                        View Plans
                                    </Button>
                                    <Button onClick={() => setShowUpgradeModal(false)}>
                                        Maybe Later
                                    </Button>
                                </InlineStack>
                            </BlockStack>
                        </Box>
                    </Card>
                </div>
            )}
        </Page>
    );
}
