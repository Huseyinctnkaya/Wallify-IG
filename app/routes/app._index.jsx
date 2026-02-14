import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
    Page,
    Layout,
    Card,
    BlockStack,
    Button,
    Text,
    IndexTable,
    useIndexResourceState,
    Thumbnail,
    InlineStack,
    Badge,
    Banner,
    Box
} from "@shopify/polaris";
import {
    DeleteIcon,
    DuplicateIcon,
    PlusIcon
} from "@shopify/polaris-icons";
import { useState, useEffect } from "react";
import { getInstagramAccount, connectInstagramAccount } from "../models/instagram.server";
import { getWidgets, deleteWidget } from "../models/widget.server"; // syncInstagramMedia removed? We need to call it via action
import { WidgetEditor } from "../components/WidgetEditor";

export async function loader({ request }) {
    const { session, admin } = await authenticate.admin(request);

    const account = await getInstagramAccount(session.shop);
    const widgets = await getWidgets(session.shop);

    const hasCredentials = !!process.env.INSTAGRAM_ACCESS_TOKEN;
    const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

    return json({ instagramAccount: account, widgets, hasCredentials, businessAccountId });
}

export async function action({ request }) {
    const { session, admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const actionType = formData.get("actionType");

    if (actionType === "connect") {
        await connectInstagramAccount(session.shop, "dummy_token"); // Basic placeholder if needed
        return json({ success: true, message: "Connected!" });
    }

    if (actionType === "sync") {
        // We need to import dynamically to avoid cyclic dependency issues if any
        // or just import at top if it's fine.
        const { syncInstagramMedia } = await import("../models/instagram.server");
        await syncInstagramMedia(session.shop, admin);
        return json({ success: true, message: "Synced!" });
    }

    if (actionType === "deleteWidget") {
        const widgetId = formData.get("widgetId");
        await deleteWidget(widgetId);
        return json({ success: true, message: "Deleted" });
    }

    // New/Update handled in separate API routes but if we need generic action here, fine.
    return null;
}

export default function Dashboard() {
    const { instagramAccount, widgets, hasCredentials, businessAccountId } = useLoaderData();
    const fetcher = useFetcher(); // General action fetcher
    const createFetcher = useFetcher(); // For creating widget
    const editFetcher = useFetcher(); // For loading widget data

    // Modal State
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    // Loaded Data for Editor
    const [editorData, setEditorData] = useState(null);

    // Handle Create Success
    useEffect(() => {
        if (createFetcher.state === "idle" && createFetcher.data?.widget) {
            // Widget created successfully, now load it for editing
            const newWidget = createFetcher.data.widget;
            // Load media as well? We need to fetch from API endpoint.
            // Since we don't have all data in create response, let's load it properly.
            editFetcher.load(`/app/widget/${newWidget.id}`);
            shopify.toast.show("Widget created");
        }
    }, [createFetcher.state, createFetcher.data]);

    // Handle Edit Data Load Success
    useEffect(() => {
        if (editFetcher.state === "idle" && editFetcher.data?.widget) {
            setEditorData(editFetcher.data);
            setIsEditorOpen(true);
        }
    }, [editFetcher.state, editFetcher.data]);


    const handleCreateWidget = () => {
        // Create widget via API
        createFetcher.submit(null, { method: "post", action: "/app/widget/new" });
        // Show loading indicator?
        shopify.toast.show("Creating widget...");
    };

    const handleEditWidget = (id) => {
        editFetcher.load(`/app/widget/${id}`);
        shopify.toast.show("Loading editor...");
    };

    const handleDeleteWidget = (id) => {
        if (confirm("Delete this widget?")) {
            fetcher.submit({ actionType: "deleteWidget", widgetId: id }, { method: "post" });
        }
    };

    const handleSync = () => fetcher.submit({ actionType: "sync" }, { method: "post" });
    const handleConnect = () => fetcher.submit({ actionType: "connect" }, { method: "post" });

    // Table resources
    const resourceName = { singular: "widget", plural: "widgets" };
    const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(widgets);

    const rowMarkup = widgets.map(({ id, title, type, status, updatedAt }, index) => (
        <IndexTable.Row id={id} key={id} selected={selectedResources.includes(id)} position={index}>
            <IndexTable.Cell>
                <Text variant="bodyMd" fontWeight="bold" as="span">{title}</Text>
            </IndexTable.Cell>
            <IndexTable.Cell>{type}</IndexTable.Cell>
            <IndexTable.Cell><Badge tone={status === "active" ? "success" : "info"}>{status}</Badge></IndexTable.Cell>
            <IndexTable.Cell>{new Date(updatedAt).toLocaleDateString()}</IndexTable.Cell>
            <IndexTable.Cell>
                <InlineStack gap="200">
                    <Button onClick={() => handleEditWidget(id)}>Edit</Button>
                    <Button icon={DeleteIcon} tone="critical" onClick={() => handleDeleteWidget(id)} />
                </InlineStack>
            </IndexTable.Cell>
        </IndexTable.Row>
    ));

    return (
        <Page title="Instagram Feed" primaryAction={{ content: "Create New Widget", icon: PlusIcon, onAction: handleCreateWidget, loading: createFetcher.state === "submitting" }}>
            <BlockStack gap="500">
                {!instagramAccount ? (
                    <Banner title="Connect Instagram" tone="warning" action={{ content: "Connect Now", onAction: handleConnect, loading: fetcher.state === "submitting" }}>
                        <p>To display your feed, you must first connect your Instagram Business account.</p>
                        {!hasCredentials && <p><strong>Note:</strong> .env file missing credentials.</p>}
                    </Banner>
                ) : (
                    <Card>
                        <BlockStack gap="400">
                            <Text variant="headingMd" as="h2">Account Status: Connected</Text>
                            <Text as="p">Connected as: <strong>{businessAccountId || "Test Account"}</strong></Text>
                            <Button onClick={handleSync} loading={fetcher.state === "submitting"}>Sync Media Now</Button>
                        </BlockStack>
                    </Card>
                )}

                <Card padding="0">
                    {widgets.length === 0 ? (
                        <div style={{ padding: "40px", textAlign: "center" }}>
                            <Text variant="headingLg" as="p">No widgets yet</Text>
                            <div style={{ marginTop: "20px" }}>
                                <Button variant="primary" onClick={handleCreateWidget} loading={createFetcher.state === "submitting"}>Create First Widget</Button>
                            </div>
                        </div>
                    ) : (
                        <IndexTable
                            resourceName={resourceName}
                            itemCount={widgets.length}
                            selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
                            onSelectionChange={handleSelectionChange}
                            headings={[
                                { title: "Title" },
                                { title: "Type" },
                                { title: "Status" },
                                { title: "Last Updated" },
                                { title: "Actions" }
                            ]}
                        >
                            {rowMarkup}
                        </IndexTable>
                    )}
                </Card>
            </BlockStack>

            {/* FULL SCREEN MODAL EDITOR */}
            {isEditorOpen && editorData && (
                <ui-modal id="editor-modal" variant="max" open>
                    <WidgetEditor
                        widget={editorData.widget}
                        media={editorData.media}
                        account={editorData.account}
                        onClose={() => setIsEditorOpen(false)}
                    />
                </ui-modal>
            )}
        </Page>
    );
}
