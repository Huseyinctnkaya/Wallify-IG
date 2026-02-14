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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getInstagramAccount, saveInstagramAccount, disconnectInstagramAccount } from "../models/instagram.server";

export async function loader({ request }) {
    const { session } = await authenticate.admin(request);
    const { shop } = session;

    const instagramAccount = await getInstagramAccount(shop);

    // Check if Instagram credentials are configured
    const hasCredentials = !!(
        process.env.INSTAGRAM_APP_ID &&
        process.env.INSTAGRAM_APP_SECRET &&
        process.env.INSTAGRAM_ACCESS_TOKEN
    );

    return json({
        instagramAccount,
        shop,
        hasCredentials,
    });
}

export async function action({ request }) {
    const { session, admin } = await authenticate.admin(request);
    const { shop } = session;
    const formData = await request.formData();
    const actionType = formData.get("actionType");

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
            const { syncInstagramToMetafields } = await import("../models/instagram.server");
            await syncInstagramToMetafields(shop, admin);
            return json({ success: true, message: "Media synced successfully!" });
        } catch (error) {
            console.error("Sync error:", error);
            return json({ error: error.message || "Failed to sync media" }, { status: 500 });
        }
    }

    return null;
}

export default function Dashboard() {
    const { instagramAccount, hasCredentials } = useLoaderData();
    const fetcher = useFetcher();

    const isLoading = fetcher.state === "submitting";

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

    return (
        <Page title="DevsApiG">
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
                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
