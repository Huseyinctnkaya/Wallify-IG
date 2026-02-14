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
        };

        await saveSettings(shop, settings);
        return json({ success: true, message: "Settings saved successfully!" });
    }

    if (actionType === "connect") {
        // ... (existing connect logic)
    }

    if (actionType === "disconnect") {
        await disconnectInstagramAccount(shop);
        return json({ success: true, message: "Instagram disconnected" });
    }

    if (actionType === "sync") {
        // ... (existing sync logic)
    }

    return null;
}

export default function Dashboard() {
    const { instagramAccount, hasCredentials, media, settings } = useLoaderData();
    const fetcher = useFetcher();

    const isLoading = fetcher.state === "submitting";
    const isSaving = isLoading && fetcher.formData?.get("actionType") === "saveSettings";

    // ... (existing handlers)

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
    const [previewMode, setPreviewMode] = useState("desktop"); // desktop | mobile

    // ... (mock images)

    const displayMedia = (media && media.length > 0) ? media : mockImages;

    return (
        <Page
            title="DevsApiG"
            primaryAction={{
                content: "Save",
                onAction: handleSave,
                loading: isSaving,
            }}
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
                                        </BlockStack>
                                    </Card>
                                </BlockStack>
                            </Grid.Cell>

                            {/* Right Column: Preview */}
                            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 8, lg: 8, xl: 8 }}>
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

                                        {/* Mock Preview Area */}
                                        <div style={{
                                            backgroundColor: "#f9fafb",
                                            padding: "20px",
                                            borderRadius: "8px",
                                            textAlign: "center",
                                            border: "1px dashed #e1e3e5"
                                        }}>
                                            <BlockStack gap="200">
                                                {title && <Text variant="headingXl" as="h2">{title}</Text>}
                                                {subheading && <Text variant="bodyLg" as="p" tone="subdued">{subheading}</Text>}
                                            </BlockStack>

                                            <div style={{ marginTop: "20px", display: "flex", gap: "10px", justifyContent: "center", flexWrap: feedType === "grid" ? "wrap" : "nowrap", overflow: "hidden" }}>
                                                {displayMedia.map((item, index) => {
                                                    const src = typeof item === 'string' ? item : (item.media_type === 'VIDEO' ? (item.thumbnail_url || item.media_url) : item.media_url);
                                                    return (
                                                        <div key={index} style={{
                                                            width: previewMode === 'mobile' ? (feedType === 'grid' ? '45%' : '80%') : '23%',
                                                            flexShrink: 0,
                                                            aspectRatio: "2/3",
                                                            backgroundImage: `url(${src})`,
                                                            backgroundSize: "cover",
                                                            backgroundPosition: "center",
                                                            borderRadius: "8px",
                                                            position: "relative"
                                                        }}>
                                                            <div style={{ position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: "5px" }}>
                                                                {/* User Avatar Placeholder */}
                                                                <div style={{ width: 20, height: 20, background: "black", borderRadius: "50%" }}></div>
                                                                <span style={{ color: "white", fontSize: "12px", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>@{instagramAccount?.username || "username"}</span>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                                {showArrows && feedType === 'slider' && previewMode === 'desktop' && (
                                                    <div style={{
                                                        position: "absolute",
                                                        right: "20px",
                                                        top: "50%",
                                                        transform: "translateY(-50%)",
                                                        background: "white",
                                                        borderRadius: "50%",
                                                        width: "30px",
                                                        height: "30px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                                        cursor: "pointer"
                                                    }}>
                                                        &gt;
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </BlockStack>
                                </Card>
                            </Grid.Cell>
                        </Grid>
                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
