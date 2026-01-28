import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useActionData, Form } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    TextField,
    Button,
    BlockStack,
    Text,
    Banner,
    Link,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { getInstagramAuthUrl, getInstagramAccount, disconnectInstagramAccount } from "../models/instagram.server";

export async function loader({ request }) {
    const { session } = await authenticate.admin(request);
    const { shop } = session;

    const instagramAccount = await getInstagramAccount(shop);

    // In a real app, Client ID/Secret might be stored in a Settings table or Env vars.
    // For this "Simple" app, we'll let the user input them or load if saved (optional).
    // For now, let's assume we want the user to provide them to "connect".

    // Also check URL for error params (returned from callback usually)
    const url = new URL(request.url);
    const error = url.searchParams.get("error");

    return json({
        instagramAccount,
        shop,
        error,
        appUrl: process.env.SHOPIFY_APP_URL || ""
    });
}

export async function action({ request }) {
    const { session } = await authenticate.admin(request);
    const { shop } = session;
    const formData = await request.formData();
    const actionType = formData.get("actionType");

    if (actionType === "connect") {
        const clientId = formData.get("clientId");
        const clientSecret = formData.get("clientSecret");

        if (!clientId || !clientSecret) {
            return json({ error: "Client ID and Secret are required" }, { status: 400 });
        }

        // Save temporary credentials to session or DB to use in callback? 
        // For simplicity, we might just pass them or rely on ENV if this was a fixed app.
        // BUT since user inputs them, we should probably save them to a Settings model first.

        await prisma.settings.upsert({
            where: { shop },
            update: {
                // We'll misuse titleText/showTitle for now or rely on a new field?
                // Actually, let's just rely on passing them via state or simpler:
                // The user inputs 'Client ID' -> we generate URL.
                // But wait, the callback needs the Secret to exchange token.
                // So we MUST save them to DB first.
            },
            create: { shop }
        });

        // We need to support custom fields in Settings or just assume user puts them in env?
        // User asked for "Simple". 
        // Let's UPDATE prisma schema to store credentials if we want a "SaaS" style where they use their own App.
        // OR we provide the App and they just click "Connect"?
        // "piyasada araştırma yaptım... sayfanın adını giriyorsun otomatik bağlanıp direkt çekiyor"
        // This implies WE (the app dev) own the Instagram App and keys.
        // The user just authenticates.

        // IF WE own the keys, they should be in .env. 
        // I will assume for this "roadmap" that WE own the keys.
        // So the stored procedure is:
        // 1. User clicks "Connect".
        // 2. We use OUR env keys.
        // 3. Authorization URL is generated.

        const ENV_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID;

        if (!ENV_CLIENT_ID) {
            return json({ error: "App is not configured with Instagram Client ID. Please check .env" }, { status: 500 });
        }

        const redirectUri = `${process.env.SHOPIFY_APP_URL}/app/instagram/callback`;
        const authUrl = await getInstagramAuthUrl(shop, redirectUri, ENV_CLIENT_ID);

        return json({ authUrl });
    }

    if (actionType === "disconnect") {
        await disconnectInstagramAccount(shop);
        return json({ success: true });
    }

    return null;
}

export default function Settings() {
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

    // If fetcher returned authUrl, redirect there
    if (fetcher.data?.authUrl) {
        window.location.href = fetcher.data.authUrl;
    }

    return (
        <Page title="Instagram Feed Settings">
            <BlockStack gap="500">
                {error && (
                    <Banner tone="critical">
                        <p>Error: {error}</p>
                    </Banner>
                )}

                <Card>
                    <BlockStack gap="400">
                        <Text variant="headingMd" as="h2">
                            Instagram Connection
                        </Text>

                        {instagramAccount ? (
                            <Banner tone="success">
                                <BlockStack gap="200">
                                    <p>Connected as <strong>@{instagramAccount.username || "User"}</strong></p>
                                    <BlockStack inlineAlign="start" gap="200">
                                        <Button onClick={handleSync} loading={isLoading} variant="primary">Sync Media Now</Button>
                                        <Button variant="plain" onClick={handleDisconnect} disabled={isLoading}>Disconnect</Button>
                                    </BlockStack>
                                </BlockStack>
                            </Banner>
                        ) : (
                            <BlockStack gap="200">
                                <p>Connect your Instagram account to start displaying posts.</p>
                                <Banner tone="info" title="Configuration">
                                    <p>Ensure `INSTAGRAM_CLIENT_ID` and `INSTAGRAM_CLIENT_SECRET` are set in your `.env` file.</p>
                                </Banner>
                                <Button variant="primary" onClick={handleConnect} loading={fetcher.state === "submitting"}>
                                    Connect Instagram
                                </Button>
                            </BlockStack>
                        )}
                    </BlockStack>
                </Card>
            </BlockStack>
        </Page>
    );
}
