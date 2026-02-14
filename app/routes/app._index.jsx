import { useState } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    Button,
    BlockStack,
    InlineStack,
    Text,
    Banner,
    Grid,
    TextField,
    Select,
    Checkbox,
    Box,
} from "@shopify/polaris";
import { MobileIcon, DesktopIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getInstagramAccount, saveInstagramAccount, disconnectInstagramAccount, fetchInstagramMedia } from "../models/instagram.server";
import { getSettings, saveSettings } from "../models/settings.server";

export async function loader({ request }) {
    const { session } = await authenticate.admin(request);
    const { shop } = session;

    const instagramAccount = await getInstagramAccount(shop);
    const settings = await getSettings(shop);
    let media = [];

    if (instagramAccount) {
        try {
            media = await fetchInstagramMedia(instagramAccount.userId, instagramAccount.accessToken);
        } catch (error) {
            console.error("Failed to fetch media for preview:", error);
        }
    }

    // Check if Instagram credentials are configured
    const hasCredentials = !!(
        process.env.INSTAGRAM_APP_ID &&
        process.env.INSTAGRAM_APP_SECRET &&
        process.env.INSTAGRAM_ACCESS_TOKEN
    );

    return json({
        instagramAccount,
        media,
        settings,
        shop,
        hasCredentials,
    });
}

// ... imports

export async function action({ request }) {
    const { session, admin } = await authenticate.admin(request);
    const { shop } = session;
    const formData = await request.formData();
    const actionType = formData.get("actionType");

    if (actionType === "saveSettings") {
        const settings = {
            title: formData.get("title"),
            subheading: formData.get("subheading"),
            feedType: formData.get("feedType"),
            showPinnedReels: formData.get("showPinnedReels") === "true",
            desktopColumns: parseInt(formData.get("desktopColumns")),
            mobileColumns: parseInt(formData.get("mobileColumns")),
            showArrows: formData.get("showArrows") === "true",
            onClick: formData.get("onClick"),
            postSpacing: formData.get("postSpacing"),
            borderRadius: formData.get("borderRadius"),
            playVideoOnHover: formData.get("playVideoOnHover") === "true",
            showThumbnail: formData.get("showThumbnail") === "true",
            showViewsCount: formData.get("showViewsCount") === "true",
            showAuthorProfile: formData.get("showAuthorProfile") === "true",
            showAttachedProducts: formData.get("showAttachedProducts") === "true",
        };

        await saveSettings(shop, settings);
        return json({ success: true, message: "Settings saved successfully!" });
    }

    if (actionType === "connect") {
        // Connect using environment variables
        const appId = process.env.INSTAGRAM_APP_ID;
        const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

        if (!appId || !accessToken) {
            return json({
                error: "Instagram credentials not configured in .env file"
            }, { status: 500 });
        }

        try {
            // Fetch user profile to get username
            const { fetchUserProfile } = await import("../models/instagram.server");
            const profile = await fetchUserProfile(accessToken);

            // Save to database
            await saveInstagramAccount({
                shop,
                accessToken,
                userId: profile.id,
                username: profile.username,
            });

            return json({ success: true, message: "Instagram connected successfully!" });
        } catch (error) {
            console.error("Connect error:", error);
            return json({ error: error.message || "Failed to connect Instagram" }, { status: 500 });
        }
    }

    if (actionType === "disconnect") {
        await disconnectInstagramAccount(shop);
        return json({ success: true, message: "Instagram disconnected" });
    }

    if (actionType === "sync") {
        try {
            const account = await getInstagramAccount(shop);
            if (!account) {
                return json({ error: "No Instagram account connected" }, { status: 400 });
            }

            const { syncInstagramToMetafields } = await import("../models/instagram.server");

            // Re-fetch media from Instagram API
            const media = await fetchInstagramMedia(account.userId, account.accessToken);

            // Update media in database/metafields if needed
            // For now, we just return success as the loader fetches fresh data

            return json({ success: true, message: "Media synced successfully!" });
        } catch (error) {
            console.error("Sync error:", error);
            return json({ error: error.message || "Failed to sync media" }, { status: 500 });
        }
    }

    return null;
}

export default function Dashboard() {
    const { instagramAccount, hasCredentials, media, settings } = useLoaderData();
    const fetcher = useFetcher();

    const isLoading = fetcher.state === "submitting";
    const isSaving = isLoading && fetcher.formData?.get("actionType") === "saveSettings";

    // ... (existing handlers)

    const handleConnect = () => {
        fetcher.submit(
            { actionType: "connect" },
            { method: "post" }
        );
    };

    const handleDisconnect = () => {
        if (confirm("Are you sure you want to disconnect Instagram?")) {
            fetcher.submit(
                { actionType: "disconnect" },
                { method: "post" }
            );
        }
    };

    const handleSync = () => {
        fetcher.submit(
            { actionType: "sync" },
            { method: "post" }
        );
    };

    const handleSave = () => {
        const formData = new FormData();
        formData.append("actionType", "saveSettings");
        formData.append("title", title);
        formData.append("subheading", subheading);
        formData.append("feedType", feedType);
        formData.append("showPinnedReels", showPinnedReels);
        formData.append("desktopColumns", desktopColumns);
        formData.append("mobileColumns", mobileColumns);
        formData.append("showArrows", showArrows);
        formData.append("onClick", onClick);
        formData.append("postSpacing", postSpacing);
        formData.append("borderRadius", borderRadius);
        formData.append("playVideoOnHover", playVideoOnHover);
        formData.append("showThumbnail", showThumbnail);
        formData.append("showViewsCount", showViewsCount);
        formData.append("showAuthorProfile", showAuthorProfile);
        formData.append("showAttachedProducts", showAttachedProducts);

        fetcher.submit(formData, { method: "post" });
    };

    // Dashboard State
    const [title, setTitle] = useState(settings?.title || "INSTAGRAM'DA BİZ");
    const [subheading, setSubheading] = useState(settings?.subheading || "Daha Fazlası İçin Bizi Takip Edebilirsiniz");
    const [feedType, setFeedType] = useState(settings?.feedType || "slider");
    const [showPinnedReels, setShowPinnedReels] = useState(settings?.showPinnedReels || false);
    const [desktopColumns, setDesktopColumns] = useState(settings?.desktopColumns?.toString() || "4");
    const [mobileColumns, setMobileColumns] = useState(settings?.mobileColumns?.toString() || "2");
    const [showArrows, setShowArrows] = useState(settings?.showArrows || true);
    const [onClick, setOnClick] = useState(settings?.onClick || "popup");
    const [postSpacing, setPostSpacing] = useState(settings?.postSpacing || "medium");
    const [borderRadius, setBorderRadius] = useState(settings?.borderRadius || "medium");
    const [playVideoOnHover, setPlayVideoOnHover] = useState(settings?.playVideoOnHover || false);
    const [showThumbnail, setShowThumbnail] = useState(settings?.showThumbnail || false);
    const [showViewsCount, setShowViewsCount] = useState(settings?.showViewsCount || false);
    const [showAuthorProfile, setShowAuthorProfile] = useState(settings?.showAuthorProfile ?? true);
    const [showAttachedProducts, setShowAttachedProducts] = useState(settings?.showAttachedProducts ?? true);
    const [previewMode, setPreviewMode] = useState("desktop"); // desktop | mobile
    const [currentSlide, setCurrentSlide] = useState(0);
    const [selectedMedia, setSelectedMedia] = useState(null);

    // ... (mock images)

    const isDirty = (
        title !== (settings?.title || "INSTAGRAM'DA BİZ") ||
        subheading !== (settings?.subheading || "Daha Fazlası İçin Bizi Takip Edebilirsiniz") ||
        feedType !== (settings?.feedType || "slider") ||
        showPinnedReels !== (settings?.showPinnedReels || false) ||
        desktopColumns !== (settings?.desktopColumns?.toString() || "4") ||
        mobileColumns !== (settings?.mobileColumns?.toString() || "2") ||
        showArrows !== (settings?.showArrows || true) ||
        onClick !== (settings?.onClick || "popup") ||
        postSpacing !== (settings?.postSpacing || "medium") ||
        borderRadius !== (settings?.borderRadius || "medium") ||
        playVideoOnHover !== (settings?.playVideoOnHover || false) ||
        showThumbnail !== (settings?.showThumbnail || false) ||
        showViewsCount !== (settings?.showViewsCount || false) ||
        showAuthorProfile !== (settings?.showAuthorProfile ?? true) ||
        showAttachedProducts !== (settings?.showAttachedProducts ?? true)
    );

    const spacingMap = { none: '0px', low: '4px', medium: '12px', high: '24px' };
    const radiusMap = { none: '0px', low: '4px', medium: '12px', high: '24px' };

    // Mock images for preview if no instagram account connected
    const mockImages = [
        "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=600&fit=crop",
        "https://images.unsplash.com/photo-1529139574466-a302d2d3f524?w=400&h=600&fit=crop",
        "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=600&fit=crop",
        "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=400&h=600&fit=crop"
    ];

    const displayMedia = (media && media.length > 0) ? media : mockImages;

    return (
        <Page
            title="DevsApiG"
        >
            <Layout>
                <Layout.Section>
                    <BlockStack gap="400">
                        {!hasCredentials && (
                            <Banner tone="warning">
                                <p>Instagram credentials not configured. Please add INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, and INSTAGRAM_ACCESS_TOKEN to your .env file.</p>
                            </Banner>
                        )}

                        {fetcher.data?.error && (
                            <Banner tone="critical">
                                <p>{fetcher.data.error}</p>
                            </Banner>
                        )}

                        {fetcher.data?.success && fetcher.data?.message && (
                            <Banner tone="success">
                                <p>{fetcher.data.message}</p>
                            </Banner>
                        )}

                        <Card>
                            <BlockStack gap="300">
                                <Text variant="headingMd" as="h2">
                                    How it works
                                </Text>
                                <BlockStack gap="200">
                                    <Text variant="bodyMd" as="p">
                                        1. Connect your Instagram business account
                                    </Text>
                                    <Text variant="bodyMd" as="p">
                                        2. Sync your media to fetch the latest posts
                                    </Text>
                                    <Text variant="bodyMd" as="p">
                                        3. Add the Instagram Feed block to your theme
                                    </Text>
                                </BlockStack>
                            </BlockStack>
                        </Card>

                        <Card>
                            <BlockStack gap="400">
                                <Text variant="headingMd" as="h2">
                                    Instagram Connection
                                </Text>

                                {instagramAccount ? (
                                    <BlockStack gap="300">
                                        <InlineStack gap="200" blockAlign="center">
                                            <div style={{
                                                width: "8px",
                                                height: "8px",
                                                borderRadius: "50%",
                                                backgroundColor: "#00a650"
                                            }} />
                                            <Text variant="bodyMd" as="p">
                                                Connected as <strong>@{instagramAccount.username}</strong>
                                            </Text>
                                        </InlineStack>

                                        <InlineStack gap="200">
                                            <Button
                                                onClick={handleSync}
                                                loading={isLoading && fetcher.formData?.get("actionType") === "sync"}
                                            >
                                                Sync Media
                                            </Button>
                                            <Button
                                                onClick={handleDisconnect}
                                                loading={isLoading && fetcher.formData?.get("actionType") === "disconnect"}
                                                tone="critical"
                                            >
                                                Disconnect
                                            </Button>
                                        </InlineStack>
                                    </BlockStack>
                                ) : (
                                    <BlockStack gap="300">
                                        <Text variant="bodyMd" as="p" tone="subdued">
                                            Connect your Instagram business account to display your feed.
                                        </Text>
                                        <div>
                                            <Button
                                                variant="primary"
                                                onClick={handleConnect}
                                                loading={isLoading}
                                                disabled={!hasCredentials}
                                            >
                                                Connect Instagram
                                            </Button>
                                        </div>
                                    </BlockStack>
                                )}
                            </BlockStack>
                        </Card>

                        {isDirty && (
                            <Banner tone="warning" title="Unsaved Changes">
                                <p>You have unsaved changes in your feed settings. Please save them to see the changes on your storefront.</p>
                            </Banner>
                        )}

                        {/* Editor Section */}
                        <Grid>
                            {/* Left Column: Settings */}
                            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
                                <BlockStack gap="400">
                                    <Card>
                                        <BlockStack gap="400">
                                            <Text variant="headingMd" as="h3">Feed settings</Text>
                                            <TextField
                                                label="Title"
                                                value={title}
                                                onChange={setTitle}
                                                autoComplete="off"
                                            />
                                            <TextField
                                                label="Subheading"
                                                value={subheading}
                                                onChange={setSubheading}
                                                autoComplete="off"
                                                multiline={2}
                                            />
                                            <Select
                                                label="Feed type"
                                                options={[
                                                    { label: 'Slider', value: 'slider' },
                                                    { label: 'Grid', value: 'grid' },
                                                ]}
                                                value={feedType}
                                                onChange={setFeedType}
                                            />
                                            <Checkbox
                                                label="Show pinned reels only"
                                                checked={showPinnedReels}
                                                onChange={setShowPinnedReels}
                                            />
                                        </BlockStack>
                                    </Card>

                                    <Card>
                                        <BlockStack gap="400">
                                            <Text variant="headingMd" as="h3">Slider settings</Text>
                                            <TextField
                                                label="Columns (Desktop)"
                                                type="number"
                                                value={desktopColumns}
                                                onChange={setDesktopColumns}
                                                autoComplete="off"
                                            />
                                            <TextField
                                                label="Columns (Mobile)"
                                                type="number"
                                                value={mobileColumns}
                                                onChange={setMobileColumns}
                                                autoComplete="off"
                                            />
                                            <Checkbox
                                                label="Show arrows to slide left/right"
                                                checked={showArrows}
                                                onChange={setShowArrows}
                                            />
                                            <div style={{ marginTop: "10px" }}></div>
                                        </BlockStack>
                                    </Card>

                                    <Card>
                                        <BlockStack gap="400">
                                            <Text variant="headingMd" as="h3">Card settings</Text>
                                            <Select
                                                label="On click"
                                                options={[
                                                    { label: 'Open in Popup', value: 'popup' },
                                                    { label: 'Open on Instagram', value: 'instagram' },
                                                ]}
                                                value={onClick}
                                                onChange={setOnClick}
                                            />
                                            <Select
                                                label="Post spacing"
                                                options={[
                                                    { label: 'None', value: 'none' },
                                                    { label: 'Low', value: 'low' },
                                                    { label: 'Medium', value: 'medium' },
                                                    { label: 'High', value: 'high' },
                                                ]}
                                                value={postSpacing}
                                                onChange={setPostSpacing}
                                            />
                                            <Select
                                                label="Border radius"
                                                options={[
                                                    { label: 'None', value: 'none' },
                                                    { label: 'Low', value: 'low' },
                                                    { label: 'Medium', value: 'medium' },
                                                    { label: 'High', value: 'high' },
                                                ]}
                                                value={borderRadius}
                                                onChange={setBorderRadius}
                                            />
                                            <BlockStack gap="200">
                                                <Checkbox
                                                    label="Play full video on hover"
                                                    checked={playVideoOnHover}
                                                    onChange={setPlayVideoOnHover}
                                                />
                                                <Checkbox
                                                    label="Show image thumbnail (instead of video preview clip)"
                                                    checked={showThumbnail}
                                                    onChange={setShowThumbnail}
                                                />
                                                <Checkbox
                                                    label="Show views count"
                                                    checked={showViewsCount}
                                                    onChange={setShowViewsCount}
                                                />
                                                <Checkbox
                                                    label="Show author profile"
                                                    checked={showAuthorProfile}
                                                    onChange={setShowAuthorProfile}
                                                />
                                                <Checkbox
                                                    label="Show attached products"
                                                    checked={showAttachedProducts}
                                                    onChange={setShowAttachedProducts}
                                                />
                                                <Box opacity="0.5">
                                                    <Checkbox
                                                        label="Show 5 sec preview instead of 1 sec preview"
                                                        checked={false}
                                                        disabled
                                                    />
                                                    <Text variant="bodySm" as="p" tone="subdued">
                                                        This option is available in our <Button variant="plain" url="/app/plans">premium plan</Button>.
                                                    </Text>
                                                </Box>
                                            </BlockStack>
                                        </BlockStack>
                                    </Card>
                                    <Button
                                        variant="primary"
                                        onClick={handleSave}
                                        loading={isSaving}
                                        fullWidth
                                    >
                                        Save Settings
                                    </Button>
                                </BlockStack>
                            </Grid.Cell>

                            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 8, lg: 8, xl: 8 }}>
                                <div style={{ position: "sticky", top: "20px" }}>
                                    <Card>
                                        <BlockStack gap="400">
                                            <InlineStack align="space-between" blockAlign="center">
                                                <Text variant="headingMd" as="h3">Preview</Text>
                                                <InlineStack gap="200">
                                                    <Button variant="plain">Manage videos</Button>
                                                    <Button variant="plain">Add block on homepage</Button>
                                                </InlineStack>
                                            </InlineStack>

                                            <Banner tone="warning">
                                                <p>Heading, button and few other elements shown in the above preview might look different on the storefront depending on your theme.</p>
                                            </Banner>

                                            <Box paddingBlockEnd="400">
                                                <InlineStack align="center" gap="200">
                                                    <Button
                                                        pressed={previewMode === 'mobile'}
                                                        onClick={() => setPreviewMode('mobile')}
                                                        icon={MobileIcon}
                                                    >
                                                        Mobile
                                                    </Button>
                                                    <Button
                                                        pressed={previewMode === 'desktop'}
                                                        onClick={() => setPreviewMode('desktop')}
                                                        icon={DesktopIcon}
                                                    >
                                                        Desktop
                                                    </Button>
                                                </InlineStack>
                                            </Box>

                                            {/* Preview Area */}
                                            <div style={{
                                                backgroundColor: "#f9fafb",
                                                padding: "20px",
                                                borderRadius: "8px",
                                                textAlign: "center",
                                                border: "1px dashed #e1e3e5",
                                                position: "relative"
                                            }}>
                                                <BlockStack gap="200">
                                                    {title && <Text variant="headingXl" as="h2">{title}</Text>}
                                                    {subheading && <Text variant="bodyLg" as="p" tone="subdued">{subheading}</Text>}
                                                </BlockStack>

                                                <div style={{ marginTop: "20px", position: "relative", overflow: "hidden" }}>
                                                    {/* Navigation Arrows */}
                                                    {showArrows && feedType === 'slider' && (
                                                        <>
                                                            <button
                                                                onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
                                                                disabled={currentSlide === 0}
                                                                style={{
                                                                    position: "absolute",
                                                                    left: "10px",
                                                                    top: "50%",
                                                                    transform: "translateY(-50%)",
                                                                    zIndex: 10,
                                                                    background: "white",
                                                                    border: "1px solid #e1e3e5",
                                                                    borderRadius: "50%",
                                                                    width: "32px",
                                                                    height: "32px",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    cursor: currentSlide === 0 ? "not-allowed" : "pointer",
                                                                    opacity: currentSlide === 0 ? 0.5 : 1,
                                                                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                                                                }}
                                                            >
                                                                &lt;
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const cols = previewMode === 'desktop' ? parseInt(desktopColumns) : parseInt(mobileColumns);
                                                                    setCurrentSlide(prev => Math.min(Math.max(0, displayMedia.length - cols), prev + 1));
                                                                }}
                                                                disabled={currentSlide >= Math.max(0, displayMedia.length - (previewMode === 'desktop' ? parseInt(desktopColumns) : parseInt(mobileColumns)))}
                                                                style={{
                                                                    position: "absolute",
                                                                    right: "10px",
                                                                    top: "50%",
                                                                    transform: "translateY(-50%)",
                                                                    zIndex: 10,
                                                                    background: "white",
                                                                    border: "1px solid #e1e3e5",
                                                                    borderRadius: "50%",
                                                                    width: "32px",
                                                                    height: "32px",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    cursor: currentSlide >= Math.max(0, displayMedia.length - (previewMode === 'desktop' ? parseInt(desktopColumns) : parseInt(mobileColumns))) ? "not-allowed" : "pointer",
                                                                    opacity: currentSlide >= Math.max(0, displayMedia.length - (previewMode === 'desktop' ? parseInt(desktopColumns) : parseInt(mobileColumns))) ? 0.5 : 1,
                                                                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                                                                }}
                                                            >
                                                                &gt;
                                                            </button>
                                                        </>
                                                    )}

                                                    <div style={{
                                                        display: "flex",
                                                        gap: spacingMap[postSpacing] || '12px',
                                                        justifyContent: feedType === "grid" ? "center" : "flex-start",
                                                        flexWrap: feedType === "grid" ? "wrap" : "nowrap",
                                                        transition: "transform 0.3s ease-in-out",
                                                        transform: feedType === 'slider'
                                                            ? `translateX(-${currentSlide * (100 / (previewMode === 'desktop' ? parseInt(desktopColumns) : parseInt(mobileColumns)))}%)`
                                                            : "none"
                                                    }}>
                                                        {displayMedia.map((item, index) => {
                                                            const src = typeof item === 'string' ? item : (item.media_type === 'VIDEO' ? (item.thumbnail_url || item.media_url) : item.media_url);
                                                            return (
                                                                <div key={index} style={{
                                                                    width: feedType === 'grid'
                                                                        ? (previewMode === 'mobile' ? '45%' : `calc(${(100 / parseInt(desktopColumns))}% - ${spacingMap[postSpacing] || '12px'})`)
                                                                        : `calc(${(100 / (previewMode === 'desktop' ? parseInt(desktopColumns) : parseInt(mobileColumns)))}% - ${spacingMap[postSpacing] || '12px'})`,
                                                                    flexShrink: 0,
                                                                    aspectRatio: "2/3",
                                                                    backgroundImage: `url(${src})`,
                                                                    backgroundSize: "cover",
                                                                    backgroundPosition: "center",
                                                                    borderRadius: radiusMap[borderRadius] || '12px',
                                                                    border: "1px solid #e1e3e5",
                                                                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                                                    position: "relative",
                                                                    cursor: onClick === 'popup' ? 'pointer' : 'default'
                                                                }}
                                                                    onClick={() => {
                                                                        if (onClick === 'popup') {
                                                                            setSelectedMedia(item);
                                                                        } else if (onClick === 'instagram') {
                                                                            const url = typeof item === 'string' ? 'https://instagram.com' : (item.permalink || 'https://instagram.com');
                                                                            window.open(url, '_blank');
                                                                        }
                                                                    }}
                                                                >
                                                                    {showAuthorProfile && (
                                                                        <div style={{ position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: "5px" }}>
                                                                            <div style={{ width: 20, height: 20, background: "black", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.3)" }}></div>
                                                                            <span style={{ color: "white", fontSize: "12px", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>@{instagramAccount?.username || "username"}</span>
                                                                        </div>
                                                                    )}

                                                                    <div style={{ position: "absolute", bottom: 10, right: 10, display: "flex", gap: "8px" }}>
                                                                        {showViewsCount && (
                                                                            <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(0,0,0,0.5)", padding: "2px 6px", borderRadius: "4px" }}>
                                                                                <span style={{ color: "white", fontSize: "10px" }}>👁️ 1.2k</span>
                                                                            </div>
                                                                        )}
                                                                        {showAttachedProducts && (
                                                                            <div style={{ display: "flex", alignItems: "center", background: "rgba(0,0,0,0.5)", padding: "2px 6px", borderRadius: "4px" }}>
                                                                                <span style={{ color: "white", fontSize: "10px" }}>🛍️</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </BlockStack>
                                    </Card>
                                </div>
                            </Grid.Cell>
                        </Grid>
                        <Box paddingBlockEnd="800" />
                    </BlockStack>
                </Layout.Section>
            </Layout>

            {/* Popup Preview Overlay */}
            {selectedMedia && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    backgroundColor: "rgba(0,0,0,0.9)",
                    zIndex: 1000,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                    <button
                        onClick={() => setSelectedMedia(null)}
                        style={{
                            position: "absolute",
                            top: "20px",
                            right: "20px",
                            background: "none",
                            border: "none",
                            color: "white",
                            fontSize: "30px",
                            cursor: "pointer",
                            zIndex: 1001
                        }}
                    >
                        ✕
                    </button>

                    <div style={{
                        position: "relative",
                        maxWidth: "90%",
                        maxHeight: "90%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "20px"
                    }}>
                        {/* Header info */}
                        <div style={{
                            position: "absolute",
                            top: "20px",
                            left: "20px",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            zIndex: 1002
                        }}>
                            <div style={{ width: 40, height: 40, background: "black", borderRadius: "50%", border: "1px solid white" }}></div>
                            <span style={{ color: "white", fontSize: "16px", fontWeight: "bold" }}>
                                @{instagramAccount?.username || "username"}
                            </span>
                        </div>

                        {/* Large Media Content */}
                        {typeof selectedMedia === 'string' ? (
                            <img
                                src={selectedMedia}
                                alt="Instagram Preview"
                                style={{ maxHeight: "70vh", objectFit: "contain", borderRadius: "8px" }}
                            />
                        ) : (
                            selectedMedia.media_type === 'VIDEO' ? (
                                <video
                                    src={selectedMedia.media_url}
                                    controls
                                    autoPlay
                                    style={{ maxHeight: "70vh", objectFit: "contain", borderRadius: "8px" }}
                                />
                            ) : (
                                <img
                                    src={selectedMedia.media_url}
                                    alt="Instagram Preview"
                                    style={{ maxHeight: "70vh", objectFit: "contain", borderRadius: "8px" }}
                                />
                            )
                        )}

                        {/* Footer button */}
                        <Button
                            onClick={() => {
                                const url = typeof selectedMedia === 'string' ? 'https://instagram.com' : (selectedMedia.permalink || 'https://instagram.com');
                                window.open(url, '_blank');
                            }}
                        >
                            Open in Instagram
                        </Button>
                    </div>
                </div>
            )}
        </Page>
    );
}
