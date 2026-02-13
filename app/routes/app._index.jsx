import { json } from "@remix-run/node";
import { useEffect } from "react";
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
import { getInstagramAuthUrl, getInstagramAccount, disconnectInstagramAccount } from "../models/instagram.server";

export async function loader({ request }) {
    const { session } = await authenticate.admin(request);
    const { shop } = session;

    const instagramAccount = await getInstagramAccount(shop);

    const url = new URL(request.url);
    const error = url.searchParams.get("error");

    return json({
        instagramAccount,
        shop,
        error,
    });
}

export async function action({ request }) {
    const { session, admin } = await authenticate.admin(request);
    const { shop } = session;
    const formData = await request.formData();
    const actionType = formData.get("actionType");

    if (actionType === "connect") {
        const clientId = process.env.INSTAGRAM_CLIENT_ID;
        const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return json({
                error: "Instagram app credentials not configured. Please check .env file."
            }, { status: 500 });
        }

        const redirectUri = `${process.env.SHOPIFY_APP_URL}/app/instagram/callback`;
        const authUrl = await getInstagramAuthUrl(shop, redirectUri, clientId);

        return json({ authUrl });
    }

    if (actionType === "disconnect") {
        await disconnectInstagramAccount(shop);
        return json({ success: true });
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
    const { instagramAccount, error } = useLoaderData();
    const fetcher = useFetcher();

    const handleConnect = () => {
        fetcher.submit({ actionType: "connect" }, { method: "POST" });
    };

    const handleDisconnect = () => {
        fetcher.submit({ actionType: "disconnect" }, { method: "POST" });
    };

    const handleSync = () => {
        fetcher.submit({ actionType: "sync" }, { method: "POST" });
    };

    const isLoading = fetcher.state === "submitting" || fetcher.state === "loading";

    useEffect(() => {
        if (fetcher.data?.authUrl) {
            window.open(fetcher.data.authUrl, "_top");
        }
    }, [fetcher.data]);

    return (
        <Page title="GSC Instagram Feed">
            <Layout>
                <Layout.Section>
                    <BlockStack gap="400">
                        {error && (
                            <Banner tone="critical">
                                <p>Error: {error}</p>
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
                            <BlockStack gap="400">
                                <Text variant="headingMd" as="h2">
                                    Connect Instagram business account
                                </Text>

                                {instagramAccount ? (
                                    <BlockStack gap="300">
                                        <Banner tone="success">
                                            <p>Connected as <strong>@{instagramAccount.username}</strong></p>
                                        </Banner>
                                        <InlineStack gap="200">
                                            <Button
                                                onClick={handleSync}
                                                loading={isLoading}
                                            >
                                                Sync Media
                                            </Button>
                                            <Button
                                                tone="critical"
                                                onClick={handleDisconnect}
                                                loading={isLoading}
                                            >
                                                Disconnect
                                            </Button>
                                        </InlineStack>
                                    </BlockStack>
                                ) : (
                                    <BlockStack gap="300">
                                        <Text as="p" tone="subdued">
                                            Only business accounts can be connected.{" "}
                                            <a
                                                href="https://help.instagram.com/502981923235522"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Learn how to switch to Instagram business account.
                                            </a>
                                        </Text>
                                        <InlineStack>
                                            <Button
                                                variant="primary"
                                                onClick={handleConnect}
                                                loading={isLoading}
                                            >
                                                Connect Instagram
                                            </Button>
                                        </InlineStack>
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
