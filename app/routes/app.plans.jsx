import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    Button,
    BlockStack,
    Text,
    Grid,
    List,
    Box,
    Badge,
    Banner,
} from "@shopify/polaris";
import { authenticate, PREMIUM_PLAN } from "../shopify.server";
import { isPremiumShop } from "../utils/premium.server";

export const loader = async ({ request }) => {
    const { session, admin } = await authenticate.admin(request);
    const { shop } = session;
    const isPremium = await isPremiumShop(shop, admin);

    return json({ isPremium, shop });
};

export async function action({ request }) {
    const { admin, billing } = await authenticate.admin(request);

    const formData = await request.formData();
    const actionType = formData.get("actionType");

    if (actionType === "subscribe") {
        await billing.require({
            plans: [PREMIUM_PLAN],
            isTest: true,
            onFailure: async () =>
                billing.request({
                    plan: PREMIUM_PLAN,
                    isTest: true,
                }),
        });

        return json({ success: true });
    }

    if (actionType === "cancel") {
        const response = await admin.graphql(`
            query {
                currentAppInstallation {
                    activeSubscriptions {
                        id
                        name
                        status
                    }
                }
            }
        `);
        const data = await response.json();
        const subscriptions = data?.data?.currentAppInstallation?.activeSubscriptions || [];
        const premiumSub = subscriptions.find(
            (sub) => sub.name === PREMIUM_PLAN && sub.status === "ACTIVE"
        );

        if (premiumSub) {
            await admin.graphql(
                `mutation AppSubscriptionCancel($id: ID!) {
                    appSubscriptionCancel(id: $id) {
                        userErrors {
                            field
                            message
                        }
                        appSubscription {
                            id
                            status
                        }
                    }
                }`,
                { variables: { id: premiumSub.id } }
            );
        }

        return json({ success: true, cancelled: true });
    }

    return null;
}

export default function Plans() {
    const { isPremium } = useLoaderData();
    const fetcher = useFetcher();
    const isLoading = fetcher.state === "submitting";

    const handleSubscribe = () => {
        fetcher.submit({ actionType: "subscribe" }, { method: "post" });
    };

    const handleCancel = () => {
        if (confirm("Are you sure you want to cancel your Premium subscription?")) {
            fetcher.submit({ actionType: "cancel" }, { method: "post" });
        }
    };

    return (
        <Page title="Plans">
            <Layout>
                <Layout.Section>
                    {fetcher.data?.cancelled && (
                        <Box paddingBlockEnd="400">
                            <Banner tone="info">
                                <p>Your Premium subscription has been cancelled.</p>
                            </Banner>
                        </Box>
                    )}

                    <div style={{ marginTop: "20px" }}>
                        <Grid>
                            {/* Free Plan */}
                            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
                                <Card>
                                    <BlockStack gap="400">
                                        <BlockStack gap="200">
                                            <Text variant="headingXl" as="h3">
                                                Free
                                            </Text>
                                            <Text variant="bodylg" as="p" tone="subdued">
                                                Perfect for getting started
                                            </Text>
                                            <Text variant="heading2xl" as="p">
                                                $0 <Text variant="bodyMd" as="span" tone="subdued">/month</Text>
                                            </Text>
                                        </BlockStack>

                                        <Box paddingBlockStart="200" paddingBlockEnd="200">
                                            {!isPremium ? (
                                                <Button fullWidth disabled>Current Plan</Button>
                                            ) : (
                                                <Button fullWidth onClick={handleCancel} loading={isLoading} tone="critical">
                                                    Downgrade to Free
                                                </Button>
                                            )}
                                        </Box>

                                        <BlockStack gap="300">
                                            <Text variant="headingSm" as="h4">
                                                Includes:
                                            </Text>
                                            <List type="bullet">
                                                <List.Item>Basic Analytics</List.Item>
                                                <List.Item>Daily Auto-Sync</List.Item>
                                                <List.Item>Slider Layout Only</List.Item>
                                                <List.Item>Max 12 Photos & Videos</List.Item>
                                                <List.Item>Mobile Responsive</List.Item>
                                                <List.Item>Basic Support</List.Item>
                                            </List>
                                        </BlockStack>
                                    </BlockStack>
                                </Card>
                            </Grid.Cell>

                            {/* Premium Plan */}
                            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
                                <Card>
                                    <BlockStack gap="400">
                                        <BlockStack gap="200">
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <Text variant="headingXl" as="h3">
                                                    Premium
                                                </Text>
                                                <Badge tone="success">Recommended</Badge>
                                            </div>
                                            <Text variant="bodylg" as="p" tone="subdued">
                                                For growing brands
                                            </Text>
                                            <Text variant="heading2xl" as="p">
                                                $2.99{" "}
                                                <span style={{ textDecorationLine: "line-through", color: "#6d7175", fontSize: "16px" }}>
                                                    $5.00
                                                </span>{" "}
                                                <Text variant="bodyMd" as="span" tone="subdued">/month</Text>
                                            </Text>
                                        </BlockStack>

                                        <Box paddingBlockStart="200" paddingBlockEnd="200">
                                            {isPremium ? (
                                                <Button variant="primary" fullWidth disabled>Current Plan</Button>
                                            ) : (
                                                <Button variant="primary" fullWidth onClick={handleSubscribe} loading={isLoading}>
                                                    Upgrade to Premium
                                                </Button>
                                            )}
                                        </Box>

                                        <BlockStack gap="300">
                                            <Text variant="headingSm" as="h4">
                                                Everything in Free, plus:
                                            </Text>
                                            <List type="bullet">
                                                <List.Item>Advanced Analytics (Week-over-week insights)</List.Item>
                                                <List.Item>Unlimited Photos & Videos</List.Item>
                                                <List.Item>Slider & Grid Layouts</List.Item>
                                                <List.Item>Pin & Hide Posts/Reels</List.Item>
                                                <List.Item>Shoppable Posts (Tag Products)</List.Item>
                                                <List.Item>Show Pinned Reels Only Filter</List.Item>
                                                <List.Item>Real-time Sync</List.Item>
                                                <List.Item>Priority Support</List.Item>
                                            </List>
                                        </BlockStack>
                                    </BlockStack>
                                </Card>
                            </Grid.Cell>
                        </Grid>
                    </div>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
