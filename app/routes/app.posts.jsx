import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";
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
    const instagramConnected = !!instagramAccount;
    const isPremium = await isPremiumShop(shop);
    const freeMediaLimit = Math.min(Number(settings.mediaLimit) || 12, 12);
    const premiumMediaLimit = Number(settings.mediaLimit) > 0 ? Number(settings.mediaLimit) : 12;
    const effectiveMediaLimit = isPremium ? premiumMediaLimit : freeMediaLimit;
    let posts = [];

    if (instagramAccount) {
        try {
            // Fetch Instagram media
            const media = await fetchInstagramMedia(
                instagramAccount.userId,
                instagramAccount.accessToken,
                effectiveMediaLimit
            );

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
                    videoUrl: (item.media_type === 'VIDEO' || item.media_type === 'REEL') ? item.media_url : null,
                    permalink: item.permalink,
                    mediaType: item.media_type,
                    caption: item.caption || '',
                    // Merge Post metadata
                    isPinned: record?.isPinned || false,
                    isHidden: record?.isHidden || false,
                    products: record?.products ? JSON.parse(record.products) : []
                };
            });

            // Note: showPinnedReels filter is NOT applied on management page
            // It only affects the storefront (theme) display
            // Here we show ALL posts so users can manage them
        } catch (error) {
            console.error("Failed to fetch media for management page:", error);
        }
    }

    return json({
        posts,
        isPremium,
        instagramConnected,
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
    const [showSuccessBanner, setShowSuccessBanner] = useState(false);
    const [isSuccessBannerClosing, setIsSuccessBannerClosing] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");

    useEffect(() => {
        if (fetcher.data?.success && fetcher.data?.message) {
            setSuccessMessage(fetcher.data.message);
            setShowSuccessBanner(true);
            setIsSuccessBannerClosing(false);

            const closeTimer = setTimeout(() => {
                setIsSuccessBannerClosing(true);
            }, 5200);

            const hideTimer = setTimeout(() => {
                setShowSuccessBanner(false);
                setIsSuccessBannerClosing(false);
            }, 5600);

            return () => {
                clearTimeout(closeTimer);
                clearTimeout(hideTimer);
            };
        }
    }, [fetcher.data?.success, fetcher.data?.message]);

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

    const handleDeleteProducts = () => {
        if (!isPremium) {
            onShowUpgrade();
            return;
        }

        fetcher.submit(
            {
                actionType: "updateProducts",
                mediaId: post.id,
                products: JSON.stringify([])
            },
            { method: "post" }
        );
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
                        {post.videoUrl ? (
                            <video
                                src={post.videoUrl}
                                poster={post.mediaUrl}
                                autoPlay
                                muted
                                loop
                                playsInline
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            <img
                                src={post.mediaUrl}
                                alt="Instagram post"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        )}
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

                    <InlineStack align="start" gap="200">
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
                        {post.products && post.products.length > 0 && (
                            <Button
                                size="slim"
                                tone="critical"
                                onClick={handleDeleteProducts}
                                disabled={!isPremium || isLoading}
                            >
                                <InlineStack gap="150" blockAlign="center">
                                    <Text variant="bodySm" as="span">Delete products</Text>
                                    {!isPremium && <ProBadge />}
                                </InlineStack>
                            </Button>
                        )}
                    </InlineStack>

                    {showSuccessBanner && successMessage && (
                        <div
                            style={{
                                overflow: 'hidden',
                                transition: 'opacity 0.35s ease, transform 0.35s ease, max-height 0.35s ease, margin 0.35s ease',
                                opacity: isSuccessBannerClosing ? 0 : 1,
                                transform: isSuccessBannerClosing ? 'translateY(-8px)' : 'translateY(0)',
                                maxHeight: isSuccessBannerClosing ? '0px' : '100px',
                                marginTop: isSuccessBannerClosing ? '0px' : '0px',
                                marginBottom: isSuccessBannerClosing ? '0px' : '0px',
                            }}
                        >
                            <Banner tone="success">
                                <Text variant="bodySm">{successMessage}</Text>
                            </Banner>
                        </div>
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
    const { posts, isPremium, instagramConnected } = useLoaderData();
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
                {!instagramConnected && (
                    <Layout.Section>
                        <Card>
                            <Box padding="800">
                                <BlockStack gap="300" inlineAlign="center">
                                    <Text variant="headingLg" as="h3">
                                        No Instagram account connected
                                    </Text>
                                    <Text variant="bodyMd" as="p" tone="subdued">
                                        There is no connected Instagram account right now. Please connect your account from the dashboard.
                                    </Text>
                                    <Button variant="primary" url="/app">
                                        Go to Dashboard
                                    </Button>
                                </BlockStack>
                            </Box>
                        </Card>
                    </Layout.Section>
                )}

                {instagramConnected && posts.length === 0 && (
                    <Layout.Section>
                        <Card>
                            <Box padding="800">
                                <BlockStack gap="300" inlineAlign="center">
                                    <Text variant="headingLg" as="h3">
                                        No posts found yet
                                    </Text>
                                    <Text variant="bodyMd" as="p" tone="subdued">
                                        Your Instagram account is connected, but no media is synced yet. Go to dashboard and click Sync Media.
                                    </Text>
                                    <Button variant="primary" url="/app">
                                        Go to Dashboard
                                    </Button>
                                </BlockStack>
                            </Box>
                        </Card>
                    </Layout.Section>
                )}

                {instagramConnected && !isPremium && (
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

                {instagramConnected && posts.length > 0 && (
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
                )}
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
