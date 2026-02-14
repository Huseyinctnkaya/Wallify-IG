import { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import {
    Layout,
    Card,
    BlockStack,
    Text,
    TextField,
    Select,
    RangeSlider,
    Tabs,
    Button,
    InlineStack,
    Banner,
    Box,
    Divider,
    Checkbox
} from "@shopify/polaris";

export function WidgetEditor({ widget, media, account, onClose }) {
    const fetcher = useFetcher();

    // Parse initial config
    // Ensure configuration is object, widget.configuration might be string or object depending on source
    const initialConfig = typeof widget.configuration === 'string'
        ? JSON.parse(widget.configuration)
        : widget.configuration;

    const [config, setConfig] = useState(initialConfig || {});
    const [selectedTab, setSelectedTab] = useState(0);
    const [isMobilePreview, setIsMobilePreview] = useState(false);

    // If title is missing in config fallback to widget title
    if (!config.title) config.title = widget.title;

    const isSaving = fetcher.state === "submitting" && fetcher.formData?.get("actionType") === "save";
    const isPublishing = fetcher.state === "submitting" && fetcher.formData?.get("actionType") === "publish";

    // Handle successful save/publish
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.success) {
            shopify.toast.show(fetcher.data.message);
            if (fetcher.data.actionType === "publish") {
                // Maybe close modal or just stay
            }
        }
    }, [fetcher.state, fetcher.data]);

    const handleConfigChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        fetcher.submit(
            { actionType: "save", configuration: JSON.stringify(config) },
            { method: "post", action: `/app/widget/${widget.id}` }
        );
    };

    const handlePublish = () => {
        fetcher.submit(
            { actionType: "publish", configuration: JSON.stringify(config) },
            { method: "post", action: `/app/widget/${widget.id}` }
        );
    };

    const tabs = [
        { id: "content-tab", content: "Content", panelID: "content-panel" },
        { id: "layout-tab", content: "Layout", panelID: "layout-panel" },
        { id: "style-tab", content: "Style", panelID: "style-panel" },
    ];

    return (
        <div style={{ height: '100%' }}>
            <ui-title-bar title={config.title || "Edit Feed"}>
                <button variant="primary" onClick={handlePublish} disabled={isPublishing}>Publish</button>
                <button onClick={handleSave} disabled={isSaving}>Save</button>
                <button onClick={onClose}>Close</button>
            </ui-title-bar>

            <div style={{ padding: '20px' }}>
                <Layout>
                    <Layout.Section variant="oneThird">
                        <Card padding="0">
                            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
                            <Box padding="400">
                                {selectedTab === 0 && (
                                    <BlockStack gap="400">
                                        <TextField label="Widget Title (Admin)" value={config.title} onChange={v => handleConfigChange("title", v)} autoComplete="off" />
                                        <Divider />
                                        <Checkbox label="Show Section Title" checked={config.showTitle} onChange={v => handleConfigChange("showTitle", v)} />
                                        {config.showTitle && (
                                            <TextField label="Section Title" value={config.sectionTitle || "Follow us on Instagram"} onChange={v => handleConfigChange("sectionTitle", v)} autoComplete="off" />
                                        )}
                                        <TextField label="Description" value={config.description} onChange={v => handleConfigChange("description", v)} autoComplete="off" multiline={3} />

                                        <Divider />
                                        <Checkbox label="Show Button" checked={config.showButton} onChange={v => handleConfigChange("showButton", v)} />
                                        {config.showButton && (
                                            <>
                                                <TextField label="Button Text" value={config.buttonText} onChange={v => handleConfigChange("buttonText", v)} autoComplete="off" />
                                                <TextField label="Button URL" value={config.buttonUrl} onChange={v => handleConfigChange("buttonUrl", v)} autoComplete="off" />
                                            </>
                                        )}
                                    </BlockStack>
                                )}

                                {selectedTab === 1 && (
                                    <BlockStack gap="400">
                                        <Select label="Layout" options={[{ label: "Grid", value: "grid" }, { label: "Carousel (Slider)", value: "carousel" }]} value={config.layout} onChange={v => handleConfigChange("layout", v)} />
                                        <RangeSlider label="Desktop Columns" value={config.columnsDesktop} min={2} max={6} output onChange={v => handleConfigChange("columnsDesktop", v)} />
                                        <RangeSlider label="Mobile Columns" value={config.columnsMobile} min={1} max={3} output onChange={v => handleConfigChange("columnsMobile", v)} />
                                        <RangeSlider label="Gap (px)" value={config.gap} min={0} max={50} output onChange={v => handleConfigChange("gap", v)} />
                                        <RangeSlider label="Limit Items" value={config.limit} min={4} max={12} output onChange={v => handleConfigChange("limit", v)} />
                                    </BlockStack>
                                )}

                                {selectedTab === 2 && (
                                    <BlockStack gap="400">
                                        <Checkbox label="Show Hover Overlay" checked={config.overlay} onChange={v => handleConfigChange("overlay", v)} />
                                        {/* <Text tone="subdued">Custom colors coming soon...</Text> */}
                                    </BlockStack>
                                )}
                            </Box>
                        </Card>
                    </Layout.Section>

                    <Layout.Section>
                        <Card>
                            <BlockStack gap="400">
                                <InlineStack align="center" gap="400">
                                    <Button pressed={!isMobilePreview} onClick={() => setIsMobilePreview(false)}>Desktop</Button>
                                    <Button pressed={isMobilePreview} onClick={() => setIsMobilePreview(true)}>Mobile</Button>
                                </InlineStack>
                                <Divider />
                                <Box padding="400" background="bg-surface-secondary">
                                    <PreviewComponent
                                        account={account}
                                        media={media}
                                        config={config}
                                        isMobile={isMobilePreview}
                                    />
                                </Box>
                            </BlockStack>
                        </Card>
                    </Layout.Section>
                </Layout>
            </div>
        </div>
    );
}

function PreviewComponent({ account, media, config, isMobile }) {
    if (!account) return <Banner tone="warning">Connect Instagram account first to see preview.</Banner>;

    // Safety check
    const mediaList = Array.isArray(media) ? media : [];
    const items = mediaList.slice(0, config.limit || 8);
    const cols = isMobile ? (config.columnsMobile || 2) : (config.columnsDesktop || 4);
    const gap = config.gap || 10;

    const containerStyle = {
        display: config.layout === "carousel" ? "flex" : "grid",
        gridTemplateColumns: config.layout === "grid" ? `repeat(${cols}, 1fr)` : "none",
        gap: `${gap}px`,
        overflowX: config.layout === "carousel" ? "auto" : "visible",
        scrollSnapType: config.layout === "carousel" ? "x mandatory" : "none",
    };

    const itemStyle = {
        position: "relative",
        aspectRatio: "1/1",
        flex: config.layout === "carousel" ? `0 0 calc(${100 / cols}% - ${gap}px)` : "auto",
        scrollSnapAlign: "start",
        minWidth: config.layout === "carousel" ? `calc(${100 / cols}% - ${gap}px)` : "auto"
    };

    return (
        <div style={{
            padding: "20px",
            background: "#fff",
            borderRadius: "8px",
            maxWidth: isMobile ? "375px" : "100%",
            margin: "0 auto",
            transition: "all 0.3s ease",
            border: "1px solid #e1e3e5",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
        }}>
            {config.showTitle && (
                <h2 style={{ textAlign: "center", marginBottom: 15, fontSize: 24, fontWeight: "bold" }}>
                    {config.sectionTitle || "Follow us on Instagram"}
                </h2>
            )}

            {config.description && (
                <p style={{ textAlign: "center", marginBottom: 20, color: "#666", lineHeight: 1.5 }}>
                    {config.description}
                </p>
            )}

            <div style={containerStyle}>
                {items.length > 0 ? items.map(item => (
                    <div key={item.id} style={itemStyle}>
                        <img
                            src={item.media_url || item.thumbnail_url}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: 8 }}
                        />
                        {config.overlay && (
                            <div style={{
                                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                                background: "rgba(0,0,0,0.3)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                opacity: 0, transition: "opacity 0.2s",
                                color: "#fff", fontWeight: "bold",
                                borderRadius: 8
                            }}
                                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                onMouseLeave={e => e.currentTarget.style.opacity = 0}
                            >
                                @{item.username}
                            </div>
                        )}
                    </div>
                )) : (
                    <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 20, background: "#f9f9f9" }}>
                        No media found.
                    </div>
                )}
            </div>

            {config.showButton && (
                <div style={{ textAlign: "center", marginTop: 25 }}>
                    <a href={config.buttonUrl} target="_blank" style={{
                        display: "inline-block", padding: "12px 24px", background: "#000", color: "#fff",
                        textDecoration: "none", borderRadius: 4, fontWeight: "bold"
                    }}>
                        {config.buttonText}
                    </a>
                </div>
            )}
        </div>
    );
}
