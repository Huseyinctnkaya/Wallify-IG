import { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { TitleBar } from "@shopify/app-bridge-react";
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
    Checkbox,
    Spinner
} from "@shopify/polaris";

export function WidgetEditor({ widgetId, onClose }) {
    const dataFetcher = useFetcher();
    const actionFetcher = useFetcher();

    const [widgetData, setWidgetData] = useState(null);
    const [mediaData, setMediaData] = useState([]);
    const [accountData, setAccountData] = useState(null);

    const [config, setConfig] = useState({});
    const [selectedTab, setSelectedTab] = useState(0);
    const [isMobilePreview, setIsMobilePreview] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load Widget Data
    useEffect(() => {
        if (widgetId) {
            console.log("Loading widget data for:", widgetId);
            dataFetcher.load(`/app/widget/${widgetId}`);
        }
    }, [widgetId]);

    useEffect(() => {
        if (dataFetcher.state === "idle" && dataFetcher.data) {
            if (dataFetcher.data.error) {
                console.error("Widget fetch error:", dataFetcher.data.error);
                shopify.toast.show("Error: " + dataFetcher.data.error);
                return;
            }

            const w = dataFetcher.data.widget;
            if (!w) {
                console.error("Widget data is missing!", dataFetcher.data);
                shopify.toast.show("Error: Widget data missing");
                return;
            }

            console.log("Widget fetched successfully:", w);
            setWidgetData(w);
            setMediaData(dataFetcher.data.media || []);
            setAccountData(dataFetcher.data.account);

            try {
                // Handle both string and possible object configuration (if prisma changed)
                const configStr = w.configuration;
                const c = (typeof configStr === 'string' && configStr.trim().startsWith('{'))
                    ? JSON.parse(configStr)
                    : (typeof configStr === 'object' ? configStr : {});

                const parsedConfig = c || {};
                if (!parsedConfig.title) parsedConfig.title = w.title;

                // Ensure defaults
                if (!parsedConfig.layout) parsedConfig.layout = "grid";

                setConfig(parsedConfig);
            } catch (e) {
                console.error("Config parse error", e);
                setConfig({ title: w.title, layout: "grid" });
            }

            setIsLoading(false);
        }
    }, [dataFetcher.state, dataFetcher.data]);


    const isSaving = actionFetcher.state === "submitting" && actionFetcher.formData?.get("actionType") === "save";
    const isPublishing = actionFetcher.state === "submitting" && actionFetcher.formData?.get("actionType") === "publish";

    // Handle successful save/publish
    useEffect(() => {
        if (actionFetcher.state === "idle" && actionFetcher.data?.success) {
            shopify.toast.show(actionFetcher.data.message);
        }
    }, [actionFetcher.state, actionFetcher.data]);


    const handleConfigChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        if (!widgetData) return;
        actionFetcher.submit(
            { actionType: "save", configuration: JSON.stringify(config) },
            { method: "post", action: `/app/widget/${widgetData.id}` }
        );
    };

    const handlePublish = () => {
        if (!widgetData) return;
        actionFetcher.submit(
            { actionType: "publish", configuration: JSON.stringify(config) },
            { method: "post", action: `/app/widget/${widgetData.id}` }
        );
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
                <Spinner size="large" />
            </div>
        );
    }

    const tabs = [
        { id: "content-tab", content: "Content", panelID: "content-panel" },
        { id: "layout-tab", content: "Layout", panelID: "layout-panel" },
        { id: "style-tab", content: "Style", panelID: "style-panel" },
    ];

    return (
        <div style={{ height: '100%' }}>
            <TitleBar title={config.title || "Edit Feed"}>
                <button variant="primary" onClick={handlePublish} disabled={isPublishing}>Publish</button>
                <button onClick={handleSave} disabled={isSaving}>Save</button>
                <button onClick={onClose}>Close</button>
            </TitleBar>

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
                                        account={accountData}
                                        media={mediaData}
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
