import { useEffect, useRef, useState } from "react";
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
    Popover,
    ColorPicker,
    Icon,
} from "@shopify/polaris";
import { MobileIcon, DesktopIcon, ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import {
    getInstagramAccount,
    disconnectInstagramAccount,
    fetchInstagramMedia,
    syncInstagramToMetafields,
} from "../models/instagram.server";
import { resetAnalyticsForShop } from "../models/analytics.server";
import { getSettings, saveSettings } from "../models/settings.server";
import { isPremiumShop } from "../utils/premium.server";
import { getPosts } from "../models/post.server";
import { buildInstagramAuthUrl } from "../utils/instagram-oauth.server";

const INSTAGRAM_BLOCK_TYPE_FRAGMENT = "/blocks/instagram-feed/";

function readThemeFileContent(file) {
    const textContent = file?.body?.content;
    if (textContent && typeof textContent === "string") {
        return textContent;
    }

    const base64Content = file?.body?.contentBase64;
    if (base64Content && typeof base64Content === "string") {
        try {
            if (typeof Buffer !== "undefined") {
                return Buffer.from(base64Content, "base64").toString("utf8");
            }
            if (typeof atob !== "undefined") {
                return atob(base64Content);
            }
        } catch (error) {
            console.error(`Failed to decode base64 content for ${file?.filename}:`, error);
        }
    }

    return "";
}

async function listThemes(admin) {
    const response = await admin.graphql(`#graphql
        query ThemesForBlockCheck {
            themes(first: 25) {
                nodes {
                    id
                    name
                    role
                }
            }
        }
    `);
    const result = await response.json();

    if (result.errors?.length) {
        throw new Error(result.errors[0].message);
    }

    return result?.data?.themes?.nodes || [];
}

async function fetchThemeFilesPage(admin, { themeId, after = null }) {
    const response = await admin.graphql(
        `#graphql
        query ThemeFiles($themeId: ID!, $after: String) {
            theme(id: $themeId) {
                files(first: 100, after: $after) {
                    nodes {
                        filename
                        body {
                            ... on OnlineStoreThemeFileBodyText {
                                content
                            }
                            ... on OnlineStoreThemeFileBodyBase64 {
                                contentBase64
                            }
                        }
                    }
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                }
            }
        }`,
        {
            variables: {
                themeId,
                after,
            },
        }
    );

    const result = await response.json();

    if (result.errors?.length) {
        throw new Error(result.errors[0].message);
    }

    return result?.data?.theme?.files || { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
}

async function checkInstagramBlockStatus(admin, { maxPagesPerTheme = 8, onlyMainTheme = false } = {}) {
    try {
        const themes = await listThemes(admin);
        if (!themes.length) {
            return {
                status: "unknown",
                message: "No theme found for block check.",
            };
        }

        const sortedThemes = [...themes].sort((a, b) => {
            if (a.role === "MAIN" && b.role !== "MAIN") return -1;
            if (a.role !== "MAIN" && b.role === "MAIN") return 1;
            return 0;
        });

        const themesToCheck = onlyMainTheme
            ? (() => {
                const mainTheme = sortedThemes.find((theme) => theme.role === "MAIN");
                return mainTheme ? [mainTheme] : sortedThemes.slice(0, 1);
            })()
            : sortedThemes;

        let checkedThemeCount = 0;
        const themeCheckErrors = [];

        for (const theme of themesToCheck) {
            let afterCursor = null;
            let hasNextPage = true;
            let scannedPages = 0;

            try {
                while (hasNextPage && scannedPages < maxPagesPerTheme) {
                    const filesConnection = await fetchThemeFilesPage(admin, {
                        themeId: theme.id,
                        after: afterCursor,
                    });

                    // App block config lives in theme JSON templates/sections.
                    const candidateFiles = (filesConnection.nodes || []).filter((file) => {
                        const filename = file?.filename || "";
                        return filename.endsWith(".json")
                            && (filename.startsWith("templates/") || filename.startsWith("sections/"));
                    });

                    const hasBlock = candidateFiles.some((file) => {
                        const content = readThemeFileContent(file);
                        return content.includes(INSTAGRAM_BLOCK_TYPE_FRAGMENT)
                            || content.includes("/blocks/instagram-feed");
                    });

                    if (hasBlock) {
                        return {
                            status: "detected",
                            message: theme.role === "MAIN"
                                ? "Instagram Feed block detected in your live theme."
                                : `Instagram Feed block detected in theme: ${theme.name || "Draft theme"}.`,
                        };
                    }

                    hasNextPage = Boolean(filesConnection.pageInfo?.hasNextPage);
                    afterCursor = filesConnection.pageInfo?.endCursor || null;
                    scannedPages += 1;
                }

                checkedThemeCount += 1;
            } catch (themeError) {
                themeCheckErrors.push(String(themeError?.message || themeError));
            }
        }

        if (checkedThemeCount === 0 && themeCheckErrors.length > 0) {
            const rawMessage = themeCheckErrors.join(" | ");
            const lowered = rawMessage.toLowerCase();
            const isScopeIssue = lowered.includes("access denied")
                || lowered.includes("forbidden")
                || lowered.includes("read_themes");

            return {
                status: "unavailable",
                message: isScopeIssue
                    ? "Block status check requires theme read permission (read_themes)."
                    : "Could not verify block status right now.",
                debug: rawMessage,
            };
        }

        return {
            status: "not_detected",
            message: "Instagram Feed block not detected in checked themes yet.",
        };
    } catch (error) {
        const rawMessage = String(error?.message || "Block check failed");
        const lowered = rawMessage.toLowerCase();
        const isScopeIssue = lowered.includes("access denied")
            || lowered.includes("forbidden")
            || lowered.includes("read_themes");

        return {
            status: "unavailable",
            message: isScopeIssue
                ? "Block status check requires theme read permission (read_themes)."
                : "Could not verify block status right now.",
            debug: rawMessage,
        };
    }
}

async function withTimeout(promise, timeoutMs, fallbackValue, label) {
    let timeoutId;

    const timeoutPromise = new Promise((resolve) => {
        timeoutId = setTimeout(() => {
            console.warn(`${label} timed out after ${timeoutMs}ms`);
            resolve(fallbackValue);
        }, timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } catch (error) {
        console.error(`${label} failed:`, error);
        return fallbackValue;
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function loader({ request }) {
    const requestUrl = new URL(request.url);
    const { session, admin } = await authenticate.admin(request);
    const { shop } = session;

    const [instagramAccount, settings, isPremium] = await Promise.all([
        getInstagramAccount(shop),
        getSettings(shop),
        isPremiumShop(shop, admin),
    ]);
    const freeMediaLimit = Math.min(Number(settings.mediaLimit) || 12, 12);
    const premiumMediaLimit = Number(settings.mediaLimit) > 0 ? Number(settings.mediaLimit) : 12;
    const effectiveMediaLimit = isPremium ? premiumMediaLimit : freeMediaLimit;
    const effectiveShowPinnedReels = isPremium ? !!settings.showPinnedReels : false;
    let media = [];

    if (instagramAccount) {
        try {
            const [rawMedia, postRecords] = await Promise.all([
                withTimeout(
                    fetchInstagramMedia(
                        instagramAccount.userId,
                        instagramAccount.accessToken,
                        effectiveMediaLimit
                    ),
                    8000,
                    [],
                    "Instagram media fetch"
                ),
                getPosts(shop),
            ]);
            const postRecordMap = new Map(postRecords.map((post) => [post.mediaId, post]));

            // Merge Instagram data with Post metadata
            media = rawMedia.map(item => {
                const record = postRecordMap.get(item.id);

                return {
                    ...item,
                    isPinned: record?.isPinned || false,
                    isHidden: record?.isHidden || false,
                };
            });

            // Filter: Remove hidden posts
            media = media.filter(item => !item.isHidden);

            // Filter: Apply showPinnedReels setting
            if (effectiveShowPinnedReels) {
                const pinnedMedia = media.filter(item => item.isPinned);
                // Only apply filter if there are pinned posts
                // Otherwise show all media (ignore the setting)
                if (pinnedMedia.length > 0) {
                    media = pinnedMedia;
                }
            }
        } catch (error) {
            console.error("Failed to fetch media for preview:", error);
        }
    }

    // Check if Instagram credentials are configured
    const hasCredentials = !!(
        process.env.INSTAGRAM_APP_ID &&
        process.env.INSTAGRAM_APP_SECRET &&
        process.env.SHOPIFY_APP_URL
    );

    const igConnectStatus = requestUrl.searchParams.get("ig_connect");
    const igErrorDetail = requestUrl.searchParams.get("ig_error");
    const themeBlockStatus = {
        status: "unknown",
        message: "Checking block status...",
    };
    let oauthNotice = null;
    if (igConnectStatus === "success") {
        oauthNotice = {
            tone: "success",
            message: "Instagram connected successfully!",
        };
    } else if (igConnectStatus === "error") {
        const detailText = igErrorDetail
            ? ` Details: ${igErrorDetail}`
            : "";
        oauthNotice = {
            tone: "critical",
            message: `Instagram connection failed. Please verify Meta app callback/scopes and try again.${detailText}`,
        };
    }

    return json({
        instagramAccount,
        media,
        settings,
        shop,
        hasCredentials,
        isPremium,
        oauthNotice,
        themeBlockStatus,
    });
}

// ... imports

export async function action({ request }) {
    const { session, admin } = await authenticate.admin(request);
    const { shop } = session;
    const formData = await request.formData();
    const actionType = formData.get("actionType");

    if (actionType === "checkBlockStatus") {
        const mode = formData.get("mode") === "deep" ? "deep" : "quick";
        const themeBlockStatus = await withTimeout(
            checkInstagramBlockStatus(admin, {
                maxPagesPerTheme: mode === "deep" ? 8 : 3,
                onlyMainTheme: mode !== "deep",
            }),
            mode === "deep" ? 7000 : 4500,
            {
                status: "unavailable",
                message: mode === "deep"
                    ? "Could not complete full block check. Please click Refresh again."
                    : "Could not verify block status quickly. Click Refresh for full check.",
            },
            "Theme block status check"
        );

        return json({ themeBlockStatus, mode });
    }

    if (actionType === "saveSettings") {
        const isPremium = await isPremiumShop(shop, admin);
        const parsedMediaLimit = parseInt(formData.get("mediaLimit"), 10);
        const normalizedMediaLimit = Number.isFinite(parsedMediaLimit) && parsedMediaLimit > 0
            ? parsedMediaLimit
            : 12;
        const settings = {
            title: formData.get("title"),
            subheading: formData.get("subheading"),
            buttonText: formData.get("buttonText"),
            feedType: isPremium ? formData.get("feedType") : "slider",
            showPinnedReels: isPremium ? (formData.get("showPinnedReels") === "true") : false,
            mediaLimit: isPremium ? normalizedMediaLimit : Math.min(normalizedMediaLimit, 12),
            gridDesktopColumns: parseInt(formData.get("gridDesktopColumns")),
            gridMobileColumns: parseInt(formData.get("gridMobileColumns")),
            sliderDesktopColumns: parseInt(formData.get("sliderDesktopColumns")),
            sliderMobileColumns: parseInt(formData.get("sliderMobileColumns")),
            showArrows: formData.get("showArrows") === "true",
            onClick: formData.get("onClick"),
            postSpacing: formData.get("postSpacing"),
            borderRadius: formData.get("borderRadius"),
            playVideoOnHover: formData.get("playVideoOnHover") === "true",
            showThumbnail: formData.get("showThumbnail") === "true",
            showViewsCount: formData.get("showViewsCount") === "true",
            showAuthorProfile: formData.get("showAuthorProfile") === "true",
            showAttachedProducts: formData.get("showAttachedProducts") === "true",
            cleanDisplay: formData.get("cleanDisplay") === "true",
            titleColor: formData.get("titleColor"),
            subheadingColor: formData.get("subheadingColor"),
            arrowColor: formData.get("arrowColor"),
            arrowBackgroundColor: formData.get("arrowBackgroundColor"),
            cardUserNameColor: formData.get("cardUserNameColor"),
            cardBadgeBackgroundColor: formData.get("cardBadgeBackgroundColor"),
            cardBadgeIconColor: formData.get("cardBadgeIconColor"),
        };

        await saveSettings(shop, settings, admin);
        try {
            const account = await getInstagramAccount(shop);
            if (account) {
                await syncInstagramToMetafields(shop, admin);
            }
        } catch (error) {
            console.error("Media resync after settings update failed:", error);
        }
        return json({ success: true, message: "Settings saved successfully!" });
    }

    if (actionType === "connect") {
        try {
            const authUrl = buildInstagramAuthUrl({ shop });
            return json({ authUrl });
        } catch (error) {
            console.error("Instagram auth URL build failed:", error);
            return json({ error: "Failed to start Instagram connection" }, { status: 500 });
        }
    }

    if (actionType === "disconnect") {
        await disconnectInstagramAccount(shop);
        try {
            await resetAnalyticsForShop(shop);
        } catch (error) {
            console.error("Analytics reset after disconnect failed:", error);
        }
        return json({ success: true, message: "Instagram disconnected" });
    }

    if (actionType === "sync") {
        try {
            const account = await getInstagramAccount(shop);
            if (!account) {
                return json({ error: "No Instagram account connected" }, { status: 400 });
            }

            // Sync Instagram media to metafields
            await syncInstagramToMetafields(shop, admin);

            return json({ success: true, message: "Media synced successfully!" });
        } catch (error) {
            console.error("Sync error:", error);
            return json({ error: error.message || "Failed to sync media" }, { status: 500 });
        }
    }

    return null;
}

const ColorSetting = ({ label, color, onChange, hexToHsb, hsbToHex }) => {
    const [popoverActive, setPopoverActive] = useState(false);

    const activator = (
        <Button onClick={() => setPopoverActive(prev => !prev)}>
            <InlineStack gap="200" align="center">
                <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    backgroundColor: color,
                    border: '1px solid #dfe3e8'
                }} />
                <Text variant="bodyMd" as="span">Change</Text>
            </InlineStack>
        </Button>
    );

    return (
        <InlineStack align="space-between" blockAlign="center">
            <Text variant="bodyMd" as="p">{label}</Text>
            <Popover
                active={popoverActive}
                activator={activator}
                onClose={() => setPopoverActive(false)}
            >
                <div style={{ padding: '15px' }}>
                    <BlockStack gap="300">
                        <ColorPicker
                            onChange={(hsb) => onChange(hsbToHex(hsb))}
                            color={hexToHsb(color)}
                        />
                        <TextField
                            label="Hex"
                            value={color}
                            onChange={(val) => {
                                if (/^#([0-9A-F]{3}){1,2}$/i.test(val) || /^rgba/.test(val)) {
                                    onChange(val);
                                }
                            }}
                            autoComplete="off"
                        />
                    </BlockStack>
                </div>
            </Popover>
        </InlineStack>
    );
};

const SetupStepItem = ({
    stepNumber,
    title,
    description,
    completed,
    expanded,
    onToggle,
    children,
    hideDivider = false,
}) => (
    <div
        style={{
            padding: "16px 0",
            borderBottom: hideDivider ? "none" : "1px solid #e1e3e5",
        }}
    >
        <BlockStack gap="200">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={expanded}
                style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    margin: 0,
                    cursor: "pointer",
                    textAlign: "left",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                        }}
                    >
                        <div
                            style={{
                                width: "22px",
                                height: "22px",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "12px",
                                fontWeight: 700,
                                color: completed ? "#ffffff" : "#616161",
                                backgroundColor: completed ? "#1f1f1f" : "transparent",
                                border: completed ? "none" : "2px dashed #8c9196",
                            }}
                        >
                            {completed ? "✓" : stepNumber}
                        </div>
                        <Text variant="headingSm" as="h3">
                            {title}
                        </Text>
                    </div>
                    <div style={{ flexShrink: 0, marginLeft: "16px" }}>
                        <Icon
                            source={expanded ? ChevronUpIcon : ChevronDownIcon}
                            tone="subdued"
                        />
                    </div>
                </div>
            </button>
            <div
                style={{
                    display: "grid",
                    gridTemplateRows: expanded ? "1fr" : "0fr",
                    transition: "grid-template-rows 220ms ease, opacity 220ms ease",
                    opacity: expanded ? 1 : 0,
                }}
            >
                <div style={{ overflow: "hidden", minHeight: 0 }}>
                    <BlockStack gap="200">
                        <Text variant="bodyMd" as="p" tone="subdued">
                            {description}
                        </Text>
                        {children && (
                            <InlineStack gap="200">
                                {children}
                            </InlineStack>
                        )}
                    </BlockStack>
                </div>
            </div>
        </BlockStack>
    </div>
);

export default function Dashboard() {
    const {
        instagramAccount,
        hasCredentials,
        media,
        settings,
        shop,
        isPremium,
        oauthNotice,
        themeBlockStatus,
    } = useLoaderData();
    const fetcher = useFetcher();
    const blockStatusFetcher = useFetcher();
    const hasTriggeredQuickBlockCheck = useRef(false);

    const isLoading = fetcher.state === "submitting";
    const currentAction = fetcher.formData?.get("actionType");
    const isSaving = isLoading && currentAction === "saveSettings";
    const activeThemeBlockStatus = blockStatusFetcher.data?.themeBlockStatus || themeBlockStatus;
    const blockCheckMode = blockStatusFetcher.data?.mode || "quick";
    const isCheckingBlockStatus = blockStatusFetcher.state !== "idle";

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
        formData.append("buttonText", buttonText);
        formData.append("feedType", isPremium ? feedType : "slider");
        formData.append("showPinnedReels", isPremium ? showPinnedReels : false);
        formData.append("mediaLimit", mediaLimit);
        formData.append("gridDesktopColumns", gridDesktopColumns);
        formData.append("gridMobileColumns", gridMobileColumns);
        formData.append("sliderDesktopColumns", sliderDesktopColumns);
        formData.append("sliderMobileColumns", sliderMobileColumns);
        formData.append("showArrows", showArrows);
        formData.append("onClick", onClick);
        formData.append("postSpacing", postSpacing);
        formData.append("borderRadius", borderRadius);
        formData.append("playVideoOnHover", playVideoOnHover);
        formData.append("showThumbnail", showThumbnail);
        formData.append("showViewsCount", showViewsCount);
        formData.append("showAuthorProfile", showAuthorProfile);
        formData.append("showAttachedProducts", showAttachedProducts);
        formData.append("cleanDisplay", cleanDisplay);
        formData.append("titleColor", titleColor);
        formData.append("subheadingColor", subheadingColor);
        formData.append("arrowColor", arrowColor);
        formData.append("arrowBackgroundColor", arrowBackgroundColor);
        formData.append("cardUserNameColor", cardUserNameColor);
        formData.append("cardBadgeBackgroundColor", cardBadgeBackgroundColor);
        formData.append("cardBadgeIconColor", cardBadgeIconColor);

        fetcher.submit(formData, { method: "post" });
    };

    // Dashboard State
    const defaultFeedType = isPremium ? (settings?.feedType || "slider") : "slider";
    const defaultShowPinnedReels = isPremium ? (settings?.showPinnedReels || false) : false;
    const defaultMediaLimit = isPremium
        ? (settings?.mediaLimit?.toString() || "12")
        : String(Math.min(Number(settings?.mediaLimit) || 12, 12));
    const feedTypeOptions = isPremium
        ? [
            { label: 'Slider', value: 'slider' },
            { label: 'Grid', value: 'grid' },
        ]
        : [
            { label: 'Slider', value: 'slider' },
        ];

    const [title, setTitle] = useState(settings?.title || "INSTAGRAM'DA BİZ");
    const [subheading, setSubheading] = useState(settings?.subheading || "Daha Fazlası İçin Bizi Takip Edebilirsiniz");
    const [buttonText, setButtonText] = useState(settings?.buttonText || "Open in Instagram");
    const [feedType, setFeedType] = useState(defaultFeedType);
    const [showPinnedReels, setShowPinnedReels] = useState(defaultShowPinnedReels);
    const [mediaLimit, setMediaLimit] = useState(defaultMediaLimit);
    const [gridDesktopColumns, setGridDesktopColumns] = useState(settings?.gridDesktopColumns?.toString() || "4");
    const [gridMobileColumns, setGridMobileColumns] = useState(settings?.gridMobileColumns?.toString() || "2");
    const [sliderDesktopColumns, setSliderDesktopColumns] = useState(settings?.sliderDesktopColumns?.toString() || "4");
    const [sliderMobileColumns, setSliderMobileColumns] = useState(settings?.sliderMobileColumns?.toString() || "2");
    const [showArrows, setShowArrows] = useState(settings?.showArrows || true);
    const [onClick, setOnClick] = useState(settings?.onClick || "popup");
    const [postSpacing, setPostSpacing] = useState(settings?.postSpacing || "medium");
    const [borderRadius, setBorderRadius] = useState(settings?.borderRadius || "medium");
    const [playVideoOnHover, setPlayVideoOnHover] = useState(settings?.playVideoOnHover || false);
    const [showThumbnail, setShowThumbnail] = useState(settings?.showThumbnail || false);
    const [showViewsCount, setShowViewsCount] = useState(settings?.showViewsCount || false);
    const [showAuthorProfile, setShowAuthorProfile] = useState(settings?.showAuthorProfile ?? true);
    const [showAttachedProducts, setShowAttachedProducts] = useState(settings?.showAttachedProducts ?? true);
    const [cleanDisplay, setCleanDisplay] = useState(settings?.cleanDisplay || false);
    const [titleColor, setTitleColor] = useState(settings?.titleColor || "#000000");
    const [subheadingColor, setSubheadingColor] = useState(settings?.subheadingColor || "#6d7175");
    const [arrowColor, setArrowColor] = useState(settings?.arrowColor || "#000000");
    const [arrowBackgroundColor, setArrowBackgroundColor] = useState(settings?.arrowBackgroundColor || "#ffffff");
    const [cardUserNameColor, setCardUserNameColor] = useState(settings?.cardUserNameColor || "#ffffff");
    const [cardBadgeBackgroundColor, setCardBadgeBackgroundColor] = useState(settings?.cardBadgeBackgroundColor || "rgba(0,0,0,0.5)");
    const [cardBadgeIconColor, setCardBadgeIconColor] = useState(settings?.cardBadgeIconColor || "#ffffff");
    const [previewMode, setPreviewMode] = useState("desktop"); // desktop | mobile
    const [currentSlide, setCurrentSlide] = useState(0);
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [showSuccessBanner, setShowSuccessBanner] = useState(false);
    const [isSuccessBannerClosing, setIsSuccessBannerClosing] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [showOauthNotice, setShowOauthNotice] = useState(Boolean(oauthNotice));
    const [isOauthNoticeClosing, setIsOauthNoticeClosing] = useState(false);
    const [isSetupGuideOpen, setIsSetupGuideOpen] = useState(true);
    const [openSetupSteps, setOpenSetupSteps] = useState({
        1: true,
        2: false,
        3: false,
    });

    // Color conversion helpers
    const hexToHsb = (hex) => {
        if (!hex || typeof hex !== 'string') return { hue: 0, saturation: 0, brightness: 0 };

        if (hex.startsWith('rgba')) {
            // Very basic fallback if we encounter rgba (since Polaris Picker is HSB)
            return { hue: 0, saturation: 0, brightness: 0 };
        }

        let hexVal = hex.replace(/^#/, '');
        if (hexVal.length === 3) hexVal = hexVal.split('').map(c => c + c).join('');

        const r = parseInt(hexVal.substring(0, 2), 16) / 255;
        const g = parseInt(hexVal.substring(2, 4), 16) / 255;
        const b = parseInt(hexVal.substring(4, 6), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;

        let h;
        const s = max === 0 ? 0 : d / max;
        const v = max;

        if (max === min) {
            h = 0;
        } else {
            if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h /= 6;
        }

        return { hue: h * 360, saturation: s, brightness: v };
    };

    const hsbToHex = (hsb) => {
        const { hue: h, saturation: s, brightness: v } = hsb;
        const i = Math.floor(h / 60);
        const f = h / 60 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        let r, g, b;
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
            default: r = v; g = t; b = p; break;
        }
        const toHex = (x) => {
            const val = Math.round(x * 255).toString(16);
            return val.length === 1 ? '0' + val : val;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    // ... (mock images)

    const isDirty = (
        title !== (settings?.title || "INSTAGRAM'DA BİZ") ||
        subheading !== (settings?.subheading || "Daha Fazlası İçin Bizi Takip Edebilirsiniz") ||
        buttonText !== (settings?.buttonText || "Open in Instagram") ||
        feedType !== defaultFeedType ||
        showPinnedReels !== defaultShowPinnedReels ||
        mediaLimit !== defaultMediaLimit ||
        gridDesktopColumns !== (settings?.gridDesktopColumns?.toString() || "4") ||
        gridMobileColumns !== (settings?.gridMobileColumns?.toString() || "2") ||
        sliderDesktopColumns !== (settings?.sliderDesktopColumns?.toString() || "4") ||
        sliderMobileColumns !== (settings?.sliderMobileColumns?.toString() || "2") ||
        showArrows !== (settings?.showArrows || true) ||
        onClick !== (settings?.onClick || "popup") ||
        postSpacing !== (settings?.postSpacing || "medium") ||
        borderRadius !== (settings?.borderRadius || "medium") ||
        playVideoOnHover !== (settings?.playVideoOnHover || false) ||
        showThumbnail !== (settings?.showThumbnail || false) ||
        showViewsCount !== (settings?.showViewsCount || false) ||
        showAuthorProfile !== (settings?.showAuthorProfile ?? true) ||
        showAttachedProducts !== (settings?.showAttachedProducts ?? true) ||
        cleanDisplay !== (settings?.cleanDisplay || false) ||
        titleColor !== (settings?.titleColor || "#000000") ||
        subheadingColor !== (settings?.subheadingColor || "#6d7175") ||
        arrowColor !== (settings?.arrowColor || "#000000") ||
        arrowBackgroundColor !== (settings?.arrowBackgroundColor || "#ffffff") ||
        cardUserNameColor !== (settings?.cardUserNameColor || "#ffffff") ||
        cardBadgeBackgroundColor !== (settings?.cardBadgeBackgroundColor || "rgba(0,0,0,0.5)") ||
        cardBadgeIconColor !== (settings?.cardBadgeIconColor || "#ffffff")
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
    const isConnectedStepComplete = Boolean(instagramAccount);
    const isSyncStepComplete = isConnectedStepComplete && Array.isArray(media) && media.length > 0;
    const isBlockStepComplete = activeThemeBlockStatus?.status === "detected";
    const completedSetupSteps = [
        isConnectedStepComplete,
        isSyncStepComplete,
        isBlockStepComplete,
    ].filter(Boolean).length;
    const blockScanNotice = activeThemeBlockStatus?.status === "not_detected" && blockCheckMode !== "deep"
        ? " Quick scan did not find it yet. Click Refresh for full check."
        : "";
    const blockStepDescription = isBlockStepComplete
        ? "Instagram Feed block is detected in your current theme."
        : `${isCheckingBlockStatus
            ? "Checking block status..."
            : (activeThemeBlockStatus?.message || "Add the Instagram Feed app block in your theme editor, then click refresh.")
        }${blockScanNotice}`;
    const storeHandle = shop?.endsWith(".myshopify.com")
        ? shop.replace(".myshopify.com", "")
        : "";
    const themeEditorUrl = storeHandle
        ? `https://admin.shopify.com/store/${storeHandle}/themes`
        : (shop ? `https://${shop}/admin/themes` : "");
    const previewButtonText = buttonText?.trim() || "Open in Instagram";
    const previewButtonUrl = instagramAccount?.username
        ? `https://instagram.com/${instagramAccount.username}`
        : (typeof displayMedia[0] !== "string" && displayMedia[0]?.permalink
            ? displayMedia[0].permalink
            : "https://instagram.com");
    const handleRefreshSetup = () => {
        blockStatusFetcher.submit(
            { actionType: "checkBlockStatus", mode: "deep" },
            { method: "post" }
        );
    };
    const handleOpenThemeEditor = () => {
        if (!themeEditorUrl) return;

        try {
            window.open(themeEditorUrl, "_top");
        } catch (error) {
            console.error("Failed to open theme editor in top frame:", error);
            window.open(themeEditorUrl, "_blank");
        }
    };
    const toggleSetupStep = (stepNumber) => {
        setOpenSetupSteps((prev) => ({
            ...prev,
            [stepNumber]: !prev[stepNumber],
        }));
    };

    useEffect(() => {
        if (fetcher.data?.authUrl) {
            window.open(fetcher.data.authUrl, "_top");
        }
    }, [fetcher.data?.authUrl]);

    useEffect(() => {
        if (hasTriggeredQuickBlockCheck.current) return;
        hasTriggeredQuickBlockCheck.current = true;

        blockStatusFetcher.submit(
            { actionType: "checkBlockStatus", mode: "quick" },
            { method: "post" }
        );
    }, [blockStatusFetcher]);

    useEffect(() => {
        if (!oauthNotice) {
            setShowOauthNotice(false);
            setIsOauthNoticeClosing(false);
            return;
        }

        setShowOauthNotice(true);
        setIsOauthNoticeClosing(false);

        const closeTimer = setTimeout(() => {
            setIsOauthNoticeClosing(true);
        }, 2000);

        const hideTimer = setTimeout(() => {
            setShowOauthNotice(false);
            setIsOauthNoticeClosing(false);
        }, 2400);

        return () => {
            clearTimeout(closeTimer);
            clearTimeout(hideTimer);
        };
    }, [oauthNotice]);

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

    return (
        <Page
            title="Wallify İG ‑ Instagram Feed"
        >
            <Layout>
                <Layout.Section>
                    <BlockStack gap="400">
                        {!hasCredentials && (
                            <Banner tone="warning">
                                <p>Instagram credentials not configured. Please add INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, and SHOPIFY_APP_URL to your .env file.</p>
                            </Banner>
                        )}

                        {showOauthNotice && oauthNotice && (
                            <div
                                style={{
                                    overflow: "hidden",
                                    transition: "opacity 0.35s ease, transform 0.35s ease, max-height 0.35s ease, margin-bottom 0.35s ease",
                                    opacity: isOauthNoticeClosing ? 0 : 1,
                                    transform: isOauthNoticeClosing ? "translateY(-8px)" : "translateY(0)",
                                    maxHeight: isOauthNoticeClosing ? "0px" : "140px",
                                    marginBottom: isOauthNoticeClosing ? "0px" : "8px",
                                }}
                            >
                                <Banner tone={oauthNotice.tone}>
                                    <p>{oauthNotice.message}</p>
                                </Banner>
                            </div>
                        )}

                        {fetcher.data?.error && (
                            <Banner tone="critical">
                                <p>{fetcher.data.error}</p>
                            </Banner>
                        )}

                        <Card>
                            <BlockStack gap="200">
                                <InlineStack align="space-between" blockAlign="center">
                                    <InlineStack gap="300" blockAlign="center">
                                        <Text variant="headingMd" as="h2">
                                            Setup Guide
                                        </Text>
                                        <div
                                            style={{
                                                padding: "4px 10px",
                                                borderRadius: "999px",
                                                backgroundColor: "#f1f2f3",
                                                fontSize: "13px",
                                                color: "#616161",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {completedSetupSteps}/3 completed
                                        </div>
                                    </InlineStack>
                                    <Button
                                        size="slim"
                                        variant="tertiary"
                                        icon={isSetupGuideOpen ? ChevronUpIcon : ChevronDownIcon}
                                        accessibilityLabel={isSetupGuideOpen ? "Collapse setup guide" : "Expand setup guide"}
                                        onClick={() => setIsSetupGuideOpen((prev) => !prev)}
                                    />
                                </InlineStack>
                                <Text variant="bodyMd" as="p" tone="subdued">
                                    Use this guide to complete your Instagram feed setup.
                                </Text>
                            </BlockStack>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateRows: isSetupGuideOpen ? "1fr" : "0fr",
                                    transition: "grid-template-rows 260ms ease, opacity 220ms ease",
                                    opacity: isSetupGuideOpen ? 1 : 0,
                                    marginTop: "14px",
                                }}
                            >
                                <div style={{ overflow: "hidden", minHeight: 0 }}>
                                    <div style={{ borderTop: "1px solid #e1e3e5" }}>
                                        <SetupStepItem
                                            stepNumber={1}
                                            title="Connect Instagram account"
                                            description={isConnectedStepComplete
                                                ? `Connected as @${instagramAccount.username}.`
                                                : "Instagram account is not connected."
                                            }
                                            completed={isConnectedStepComplete}
                                            expanded={openSetupSteps[1]}
                                            onToggle={() => toggleSetupStep(1)}
                                        />
                                        <SetupStepItem
                                            stepNumber={2}
                                            title="Sync media"
                                            description={!isConnectedStepComplete
                                                ? "Instagram is not connected yet."
                                                : (isSyncStepComplete
                                                    ? `${media.length} post(s) available for preview and sync.`
                                                    : "Media is not synced yet."
                                                )
                                            }
                                            completed={isSyncStepComplete}
                                            expanded={openSetupSteps[2]}
                                            onToggle={() => toggleSetupStep(2)}
                                        />
                                        <SetupStepItem
                                            stepNumber={3}
                                            title="Add block to theme"
                                            description={blockStepDescription}
                                            completed={isBlockStepComplete}
                                            expanded={openSetupSteps[3]}
                                            onToggle={() => toggleSetupStep(3)}
                                            hideDivider
                                        >
                                            <Button
                                                size="slim"
                                                onClick={handleOpenThemeEditor}
                                                disabled={!themeEditorUrl}
                                            >
                                                Open Theme Editor
                                            </Button>
                                            <Button
                                                size="slim"
                                                loading={isCheckingBlockStatus}
                                                onClick={handleRefreshSetup}
                                            >
                                                Refresh
                                            </Button>
                                        </SetupStepItem>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Contact Support Card */}
                        <Card>
                            <InlineStack align="space-between" blockAlign="center">
                                <BlockStack gap="200">
                                    <Text variant="headingMd" as="h3">
                                        Need Help?
                                    </Text>
                                    <Text variant="bodyMd" as="p" tone="subdued">
                                        Get support, view FAQs, or contact our team
                                    </Text>
                                </BlockStack>
                                <Button url="/app/contact">
                                    Contact Support
                                </Button>
                            </InlineStack>
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
                        {instagramAccount && (
                            <>
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
                                                    <TextField
                                                        label="Button text"
                                                        value={buttonText}
                                                        onChange={setButtonText}
                                                        autoComplete="off"
                                                        helpText="Shown below posts in preview and storefront."
                                                    />
                                                    <Select
                                                        label="Feed type"
                                                        options={feedTypeOptions}
                                                        value={feedType}
                                                        onChange={setFeedType}
                                                        helpText={!isPremium ? "Grid layout is available on Premium plan." : undefined}
                                                    />
                                                    <Checkbox
                                                        label="Show pinned reels only"
                                                        checked={showPinnedReels}
                                                        onChange={setShowPinnedReels}
                                                        disabled={!isPremium}
                                                        helpText={!isPremium ? "This feature is available on Premium plan." : undefined}
                                                    />
                                                    <TextField
                                                        label="Total posts to fetch"
                                                        type="number"
                                                        value={mediaLimit}
                                                        onChange={(value) => {
                                                            if (isPremium) {
                                                                setMediaLimit(value);
                                                                return;
                                                            }

                                                            const parsed = parseInt(value, 10);
                                                            if (!Number.isFinite(parsed)) {
                                                                setMediaLimit("12");
                                                                return;
                                                            }

                                                            setMediaLimit(String(Math.max(1, Math.min(parsed, 12))));
                                                        }}
                                                        autoComplete="off"
                                                        min={1}
                                                        max={isPremium ? undefined : 12}
                                                        helpText={isPremium
                                                            ? "Premium plan fetches exactly this many posts."
                                                            : "Free plan allows up to 12 posts."
                                                        }
                                                    />
                                                </BlockStack>
                                            </Card>

                                            <Card>
                                                <BlockStack gap="400">
                                                    <Text variant="headingMd" as="h3">Grid settings</Text>
                                                    <TextField
                                                        label="Columns (Desktop)"
                                                        type="number"
                                                        value={gridDesktopColumns}
                                                        onChange={setGridDesktopColumns}
                                                        autoComplete="off"
                                                    />
                                                    <TextField
                                                        label="Columns (Mobile)"
                                                        type="number"
                                                        value={gridMobileColumns}
                                                        onChange={setGridMobileColumns}
                                                        autoComplete="off"
                                                    />
                                                </BlockStack>
                                            </Card>

                                            <Card>
                                                <BlockStack gap="400">
                                                    <Text variant="headingMd" as="h3">Slider settings</Text>
                                                    <TextField
                                                        label="Columns (Desktop)"
                                                        type="number"
                                                        value={sliderDesktopColumns}
                                                        onChange={setSliderDesktopColumns}
                                                        autoComplete="off"
                                                    />
                                                    <TextField
                                                        label="Columns (Mobile)"
                                                        type="number"
                                                        value={sliderMobileColumns}
                                                        onChange={setSliderMobileColumns}
                                                        autoComplete="off"
                                                    />
                                                    <Checkbox
                                                        label="Show arrows"
                                                        checked={showArrows}
                                                        onChange={setShowArrows}
                                                    />
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
                                                        <Checkbox
                                                            label="Clean display (hide all text overlays)"
                                                            checked={cleanDisplay}
                                                            onChange={setCleanDisplay}
                                                            helpText="Hides caption overlays and badges. Username and profile image remain visible."
                                                        />
                                                        <Box opacity={isPremium ? "1" : "0.5"}>
                                                            <Checkbox
                                                                label="Show 5 sec preview instead of 1 sec preview"
                                                                checked={false}
                                                                disabled={!isPremium}
                                                            />
                                                            {!isPremium && (
                                                                <Text variant="bodySm" as="p" tone="subdued">
                                                                    This option is available in our <Button variant="plain" url="/app/plans">premium plan</Button>.
                                                                </Text>
                                                            )}
                                                        </Box>
                                                    </BlockStack>
                                                </BlockStack>
                                            </Card>

                                            <Card>
                                                <BlockStack gap="400">
                                                    <Text variant="headingMd" as="h3">Color settings</Text>
                                                    <BlockStack gap="300">
                                                        <ColorSetting
                                                            label="Title Color"
                                                            color={titleColor}
                                                            onChange={setTitleColor}
                                                            hexToHsb={hexToHsb}
                                                            hsbToHex={hsbToHex}
                                                        />
                                                        <ColorSetting
                                                            label="Subheading Color"
                                                            color={subheadingColor}
                                                            onChange={setSubheadingColor}
                                                            hexToHsb={hexToHsb}
                                                            hsbToHex={hsbToHex}
                                                        />
                                                        <ColorSetting
                                                            label="Arrow Icon Color"
                                                            color={arrowColor}
                                                            onChange={setArrowColor}
                                                            hexToHsb={hexToHsb}
                                                            hsbToHex={hsbToHex}
                                                        />
                                                        <ColorSetting
                                                            label="Arrow Background"
                                                            color={arrowBackgroundColor}
                                                            onChange={setArrowBackgroundColor}
                                                            hexToHsb={hexToHsb}
                                                            hsbToHex={hsbToHex}
                                                        />
                                                        <ColorSetting
                                                            label="Card Username Color"
                                                            color={cardUserNameColor}
                                                            onChange={setCardUserNameColor}
                                                            hexToHsb={hexToHsb}
                                                            hsbToHex={hsbToHex}
                                                        />
                                                        <ColorSetting
                                                            label="Badge Background"
                                                            color={cardBadgeBackgroundColor}
                                                            onChange={setCardBadgeBackgroundColor}
                                                            hexToHsb={hexToHsb}
                                                            hsbToHex={hsbToHex}
                                                        />
                                                        <ColorSetting
                                                            label="Badge Icon Color"
                                                            color={cardBadgeIconColor}
                                                            onChange={setCardBadgeIconColor}
                                                            hexToHsb={hexToHsb}
                                                            hsbToHex={hsbToHex}
                                                        />
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
                                        <div style={{ position: "sticky", top: "20px", zIndex: 11 }}>
                                            {showSuccessBanner && successMessage && (
                                                <div
                                                    style={{
                                                        overflow: "hidden",
                                                        transition: "opacity 0.35s ease, transform 0.35s ease, max-height 0.35s ease, margin-bottom 0.35s ease",
                                                        opacity: isSuccessBannerClosing ? 0 : 1,
                                                        transform: isSuccessBannerClosing ? "translateY(-8px)" : "translateY(0)",
                                                        maxHeight: isSuccessBannerClosing ? "0px" : "140px",
                                                        marginBottom: isSuccessBannerClosing ? "0px" : "8px",
                                                    }}
                                                >
                                                    <Banner tone="success">
                                                        <p>{successMessage}</p>
                                                    </Banner>
                                                </div>
                                            )}
                                            {isDirty && (
                                                <Box paddingBlockEnd="200">
                                                    <Banner tone="warning" title="Unsaved Changes">
                                                        <p>You have unsaved changes in your feed settings. Please save them to see the changes on your storefront.</p>
                                                    </Banner>
                                                </Box>
                                            )}
                                            <Card>
                                                <BlockStack gap="400">
                                                    <Text variant="headingMd" as="h3">Preview</Text>

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
                                                            {title && <div style={{ color: titleColor }}><Text variant="headingXl" as="h2">{title}</Text></div>}
                                                            {subheading && <div style={{ color: subheadingColor }}><Text variant="bodyLg" as="p">{subheading}</Text></div>}
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
                                                                            background: arrowBackgroundColor,
                                                                            border: "1px solid #e1e3e5",
                                                                            borderRadius: "50%",
                                                                            width: "32px",
                                                                            height: "32px",
                                                                            display: "flex",
                                                                            alignItems: "center",
                                                                            justifyContent: "center",
                                                                            cursor: currentSlide === 0 ? "not-allowed" : "pointer",
                                                                            opacity: currentSlide === 0 ? 0.3 : 1,
                                                                            color: arrowColor,
                                                                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                                                                        }}
                                                                    >
                                                                        &lt;
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            const activeCols = feedType === 'grid'
                                                                                ? (previewMode === 'desktop' ? parseInt(gridDesktopColumns) : parseInt(gridMobileColumns))
                                                                                : (previewMode === 'desktop' ? parseInt(sliderDesktopColumns) : parseInt(sliderMobileColumns));
                                                                            setCurrentSlide(prev => Math.min(Math.max(0, displayMedia.length - activeCols), prev + 1));
                                                                        }}
                                                                        disabled={currentSlide >= Math.max(0, displayMedia.length - (feedType === 'grid'
                                                                            ? (previewMode === 'desktop' ? parseInt(gridDesktopColumns) : parseInt(gridMobileColumns))
                                                                            : (previewMode === 'desktop' ? parseInt(sliderDesktopColumns) : parseInt(sliderMobileColumns))))}
                                                                        style={{
                                                                            position: "absolute",
                                                                            right: "10px",
                                                                            top: "50%",
                                                                            transform: "translateY(-50%)",
                                                                            zIndex: 10,
                                                                            background: arrowBackgroundColor,
                                                                            border: "1px solid #e1e3e5",
                                                                            borderRadius: "50%",
                                                                            width: "32px",
                                                                            height: "32px",
                                                                            display: "flex",
                                                                            alignItems: "center",
                                                                            justifyContent: "center",
                                                                            cursor: currentSlide >= Math.max(0, displayMedia.length - (feedType === 'grid'
                                                                                ? (previewMode === 'desktop' ? parseInt(gridDesktopColumns) : parseInt(gridMobileColumns))
                                                                                : (previewMode === 'desktop' ? parseInt(sliderDesktopColumns) : parseInt(sliderMobileColumns)))) ? "not-allowed" : "pointer",
                                                                            opacity: currentSlide >= Math.max(0, displayMedia.length - (feedType === 'grid'
                                                                                ? (previewMode === 'desktop' ? parseInt(gridDesktopColumns) : parseInt(gridMobileColumns))
                                                                                : (previewMode === 'desktop' ? parseInt(sliderDesktopColumns) : parseInt(sliderMobileColumns)))) ? 0.3 : 1,
                                                                            color: arrowColor,
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
                                                                    ? `translateX(-${currentSlide * (100 / (previewMode === 'desktop' ? parseInt(sliderDesktopColumns) : parseInt(sliderMobileColumns)))}%)`
                                                                    : "none"
                                                            }}>
                                                                {displayMedia.map((item, index) => {
                                                                    const isVideo = typeof item !== 'string' && (item.media_type === 'VIDEO' || item.media_type === 'REEL');
                                                                    const src = typeof item === 'string' ? item : (isVideo ? (item.thumbnail_url || item.media_url) : item.media_url);
                                                                    const videoSrc = isVideo ? item.media_url : null;
                                                                    return (
                                                                        <div key={index} style={{
                                                                            width: feedType === 'grid'
                                                                                ? (previewMode === 'mobile' ? `calc(${(100 / parseInt(gridMobileColumns))}% - ${spacingMap[postSpacing] || '12px'})` : `calc(${(100 / parseInt(gridDesktopColumns))}% - ${spacingMap[postSpacing] || '12px'})`)
                                                                                : `calc(${(100 / (previewMode === 'desktop' ? parseInt(sliderDesktopColumns) : parseInt(sliderMobileColumns)))}% - ${spacingMap[postSpacing] || '12px'})`,
                                                                            flexShrink: 0,
                                                                            aspectRatio: "2/3",
                                                                            ...(!videoSrc && { backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center" }),
                                                                            borderRadius: radiusMap[borderRadius] || '12px',
                                                                            border: "1px solid #e1e3e5",
                                                                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                                                            position: "relative",
                                                                            cursor: onClick === 'popup' ? 'pointer' : 'default',
                                                                            overflow: "hidden"
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
                                                                            {videoSrc && (
                                                                                <video
                                                                                    src={videoSrc}
                                                                                    poster={src}
                                                                                    autoPlay
                                                                                    muted
                                                                                    loop
                                                                                    playsInline
                                                                                    style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", top: 0, left: 0 }}
                                                                                />
                                                                            )}
                                                                            {showAuthorProfile && (
                                                                                <div style={{ position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: "5px" }}>
                                                                                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.3)", overflow: "hidden", background: "#000" }}>
                                                                                        {instagramAccount?.profilePictureUrl && <img src={instagramAccount.profilePictureUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                                                                                    </div>
                                                                                    <span style={{ color: cardUserNameColor, fontSize: "12px", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>@{instagramAccount?.username || "username"}</span>
                                                                                </div>
                                                                            )}

                                                                            {!cleanDisplay && (
                                                                                <div style={{ position: "absolute", bottom: 10, right: 10, display: "flex", gap: "8px" }}>
                                                                                    {showViewsCount && (
                                                                                        <div style={{ display: "flex", alignItems: "center", gap: "4px", background: cardBadgeBackgroundColor, padding: "2px 6px", borderRadius: "4px" }}>
                                                                                            <span style={{ color: cardBadgeIconColor, fontSize: "10px" }}>👁️ 1.2k</span>
                                                                                        </div>
                                                                                    )}
                                                                                    {showAttachedProducts && (
                                                                                        <div style={{ display: "flex", alignItems: "center", background: cardBadgeBackgroundColor, padding: "2px 6px", borderRadius: "4px" }}>
                                                                                            <span style={{ color: cardBadgeIconColor, fontSize: "10px" }}>🛍️</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>

                                                        <Box paddingBlockStart="400">
                                                            <InlineStack align="center">
                                                                <Button onClick={() => window.open(previewButtonUrl, '_blank')}>
                                                                    {previewButtonText}
                                                                </Button>
                                                            </InlineStack>
                                                        </Box>
                                                    </div>
                                                </BlockStack>
                                            </Card>
                                        </div>
                                    </Grid.Cell>
                                </Grid>
                                <Box paddingBlockEnd="800" />
                            </>
                        )}
                    </BlockStack>
                </Layout.Section>
            </Layout >

            {/* Popup Preview Overlay */}
            {
                selectedMedia && (
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
                                <div style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid white", overflow: "hidden", background: "#000" }}>
                                    {instagramAccount?.profilePictureUrl && <img src={instagramAccount.profilePictureUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                                </div>
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
                )
            }

        </Page >
    );
}
