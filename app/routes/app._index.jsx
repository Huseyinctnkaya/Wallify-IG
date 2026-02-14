import { json } from "@remix-run/node";
import { useLoaderData, Form, useSubmit } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    Button,
    BlockStack,
    Text,
    InlineStack,
    Banner,
    Box,
    Divider
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getInstagramAccount, saveInstagramAccount, disconnectInstagramAccount } from "../models/instagram.server";
import { getWidgets, deleteWidget } from "../models/widget.server";

export async function loader({ request }) {
    const { session } = await authenticate.admin(request);
    const { shop } = session;

    const instagramAccount = await getInstagramAccount(shop);
    const widgets = await getWidgets(shop);

    // Check credentials env
    const hasCredentials = !!(
        process.env.INSTAGRAM_APP_ID &&
        process.env.INSTAGRAM_APP_SECRET &&
        process.env.INSTAGRAM_ACCESS_TOKEN
    );

    return json({
        instagramAccount,
        widgets,
        shop,
        hasCredentials,
    });
}

export async function action({ request }) {
    const { session, admin } = await authenticate.admin(request);
    const { shop } = session;
    const formData = await request.formData();
    const actionType = formData.get("actionType");

    if (actionType === "deleteWidget") {
        const widgetId = formData.get("widgetId");
        await deleteWidget(widgetId);
        return json({ success: true, message: "Widget deleted" });
    }

    // ... (Instagram connecting logic same as before)
    if (actionType === "connect") {
        const appId = process.env.INSTAGRAM_APP_ID;
        const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

        if (!appId || !accessToken) return json({ error: "Missing config" }, { status: 500 });

        try {
            const { fetchUserProfile } = await import("../models/instagram.server");
            const profile = await fetchUserProfile(accessToken);

            await saveInstagramAccount({
                shop,
                accessToken,
                userId: profile.id,
                username: profile.username,
            });
            return json({ success: true, message: "Connected!" });
        } catch (e) {
            return json({ error: e.message }, { status: 500 });
        }
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
    const { instagramAccount, widgets, hasCredentials } = useLoaderData();
    const submit = useSubmit();

    const handleCreateWidget = () => {
        submit(null, { method: "post", action: "/app/widget/new" });
    };

    const handleDeleteWidget = (id) => {
        if (confirm("Delete this widget?")) {
            submit({ actionType: "deleteWidget", widgetId: id }, { method: "post" });
        }
    };

    const handleSync = () => submit({ actionType: "sync" }, { method: "post" });
    const handleConnect = () => submit({ actionType: "connect" }, { method: "post" });
    const handleDisconnect = () => submit({ actionType: "disconnect" }, { method: "post" });

    return (
        <Page title="Dashboard">
            <Layout>
                <Layout.Section>
                    {/* Instagram Connection Card */}
                    <Card>
                        <BlockStack gap="400">
                            <InlineStack align="space-between" blockAlign="center">
                                <Text variant="headingMd" as="h2">Instagram Connection</Text>
                                {instagramAccount && (
                                    <Button onClick={handleSync}>Sync Media</Button>
                                )}
                            </InlineStack>

                            <Divider />

                            {instagramAccount ? (
                                <InlineStack align="space-between" blockAlign="center">
                                    <InlineStack gap="200" blockAlign="center">
                                        <div style={{ width: 10, height: 10, background: "green", borderRadius: "50%" }} />
                                        <Text>Connected as <strong>@{instagramAccount.username}</strong></Text>
                                    </InlineStack>
                                    <Button tone="critical" onClick={handleDisconnect}>Disconnect</Button>
                                </InlineStack>
                            ) : (
                                <BlockStack gap="200">
                                    <Text tone="subdued">Connect your account to fetch media.</Text>
                                    <Button variant="primary" onClick={handleConnect} disabled={!hasCredentials}>Connect Instagram</Button>
                                </BlockStack>
                            )}
                        </BlockStack>
                    </Card>
                </Layout.Section>

                <Layout.Section>
                    <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingLg" as="h1">Widgets</Text>
                        <Button variant="primary" onClick={handleCreateWidget}>Create New Widget</Button>
                    </InlineStack>
                </Layout.Section>

                <Layout.Section>
                    {widgets.length === 0 ? (
                        <Card>
                            <BlockStack gap="400" align="center">
                                <div style={{ padding: "40px", textAlign: "center" }}>
                                    <Text variant="headingMd" as="h3">No widgets yet</Text>
                                    <p style={{ marginTop: 10, marginBottom: 20 }}>Create your first widget to display Instagram feed on your store.</p>
                                    <Button variant="primary" onClick={handleCreateWidget}>Create Widget</Button>
                                </div>
                            </BlockStack>
                        </Card>
                    ) : (
                        <BlockStack gap="400">
                            {widgets.map(widget => (
                                <Card key={widget.id}>
                                    <InlineStack align="space-between" blockAlign="center">
                                        <BlockStack gap="100">
                                            <Text variant="headingMd" as="h3">{widget.title}</Text>
                                            <Text tone="subdued" as="span">ID: {widget.id}</Text>
                                        </BlockStack>
                                        <InlineStack gap="200">
                                            <Button url={`/app/widget/${widget.id}`}>Edit</Button>
                                            <Button tone="critical" onClick={() => handleDeleteWidget(widget.id)}>Delete</Button>
                                        </InlineStack>
                                    </InlineStack>
                                </Card>
                            ))}
                        </BlockStack>
                    )}
                </Layout.Section>
            </Layout>
        </Page>
    );
}
