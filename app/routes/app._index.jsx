import { json } from "@remix-run/node";
import { useEffect } from "react";
import { useLoaderData, useFetcher, useActionData, Form } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    TextField,
    Button,
    BlockStack,
    InlineStack,
    List,
    Text,
    Banner,
    Link,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { getInstagramAuthUrl, getInstagramAccount, disconnectInstagramAccount } from "../models/instagram.server";
import { useState } from "react";

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
        // We rely on ENV variables for the Client ID/Secret in this "Simple" flow
        const clientId = process.env.INSTAGRAM_CLIENT_ID;
        const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return json({ error: "Configuration Error: INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET must be set in your .env file." }, { status: 500 });
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
        console.log("DEBUG: SHOPIFY_APP_URL:", process.env.SHOPIFY_APP_URL);
        console.log("DEBUG: Generated Redirect URI:", redirectUri);

        const authUrl = await getInstagramAuthUrl(shop, redirectUri, ENV_CLIENT_ID);
        console.log("DEBUG: Auth URL:", authUrl);

        return json({ authUrl });
    }

    if (actionType === "disconnect") {
        await disconnectInstagramAccount(shop);
        return json({ success: true });
    }

    return null;
}

export default function Dashboard() {
    const { instagramAccount, error } = useLoaderData();
    const fetcher = useFetcher();
    const [username, setUsername] = useState(instagramAccount?.username || "");
    const [showInstructions, setShowInstructions] = useState(true);

    const handleDisconnect = () => {
        fetcher.submit({ actionType: "disconnect" }, { method: "POST" });
        setUsername("");
    };

    const handleSync = () => {
        fetcher.submit({ actionType: "sync" }, { method: "POST" });
    };

    const handleConnect = () => {
        // We pass the username to the action just for logging/future use, though OAuth dictates the real user
        fetcher.submit({ actionType: "connect", usernameInput: username }, { method: "POST" });
    };

    const isLoading = fetcher.state === "submitting" || fetcher.state === "loading";

    // Redirect logic moved to useEffect
    useEffect(() => {
        if (fetcher.data?.authUrl) {
            // Instagram requires running in the top window, not inside Shopify iframe
            window.open(fetcher.data.authUrl, "_top");
        }
    }, [fetcher.data]);

    useEffect(() => {
        if (instagramAccount?.username) {
            setUsername(instagramAccount.username);
        }
    }, [instagramAccount]);

    return (
        <Page title="Instagram Reels Feed">
            <BlockStack gap="600">
                {/* Error Banners */}
                {error && <Banner tone="critical"><p>Loader Error: {error}</p></Banner>}
                {fetcher.data?.error && <Banner tone="critical"><p>Action Error: {fetcher.data.error}</p></Banner>}

                {/* 1. Getting Started Section */}
                {showInstructions && (
                    <Card>
                        <BlockStack gap="400">
                            <InlineStack align="space-between">
                                <Text variant="headingSm" as="h3" fontWeight="bold">Getting Started</Text>
                                <Button variant="plain" onClick={() => setShowInstructions(false)}>Hide setup instructions</Button>
                            </InlineStack>
                            <List type="number">
                                <List.Item>Enter your Instagram username and submit. This process will take around <strong>30 seconds - 1 minute</strong></List.Item>
                                <List.Item>Review and customize your display settings in the preview section</List.Item>
                                <List.Item>Click "<strong>Add block on home page</strong>" in the preview section to add the block</List.Item>
                                <List.Item>Position the block on your page and save your changes in the editor</List.Item>
                                <List.Item>You're all set! The Instagram Reels Feed will now appear on your store</List.Item>
                            </List>
                        </BlockStack>
                    </Card>
                )}

                {/* 2. Connection / Username Input Section */}
                <Card>
                    <BlockStack gap="400">
                        <Text variant="headingSm" as="h3">Instagram Username</Text>

                        {instagramAccount ? (
                            <Banner tone="success">
                                <BlockStack gap="200">
                                    <p>Connected as <strong>@{instagramAccount.username || "User"}</strong></p>
                                    <InlineStack gap="200">
                                        <Button onClick={handleSync} loading={isLoading}>Sync Media Again</Button>
                                        <Button tone="critical" onClick={handleDisconnect} disabled={isLoading}>Disconnect</Button>
                                    </InlineStack>
                                </BlockStack>
                            </Banner>
                        ) : (
                            <>
                                <TextField
                                    label="Username"
                                    labelHidden
                                    value={username}
                                    onChange={setUsername}
                                    placeholder="e.g. nike"
                                    autoComplete="off"
                                    disabled={isLoading}
                                />
                                <Banner tone="info">
                                    <p>This process may take 30 sec - 1 min to get your data from Instagram (OAuth Login Required)</p>
                                </Banner>
                                <InlineStack>
                                    <Button variant="primary" onClick={handleConnect} loading={isLoading}>
                                        Submit
                                    </Button>
                                </InlineStack>
                            </>
                        )}
                    </BlockStack>
                </Card>

                {/* 3. Help Section */}
                <Card>
                    <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="center">
                            <BlockStack gap="200">
                                <Text variant="headingSm" as="h3">Stuck somewhere or need any help?</Text>
                                <p>We're just a message away.</p>
                                <InlineStack>
                                    <Button>Connect with us</Button>
                                </InlineStack>
                            </BlockStack>
                            {/* Illustration Placeholder - Simplified as we don't have the image asset */}
                            <div style={{ padding: '10px', opacity: 0.5 }}>
                                <Text as="span" variant="bodySm">Support Team</Text>
                            </div>
                        </InlineStack>
                    </BlockStack>
                </Card>
            </BlockStack>
        </Page>
    );
}
