
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
} from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";

export default function Plans() {
    return (
        <Page title="Plans">
            <Layout>
                <Layout.Section>
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
                                            <Button fullWidth>Current Plan</Button>
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
                                                $2.99 <Text variant="bodyMd" as="span" tone="subdued" style={{ textDecoration: "line-through" }}>$5.00</Text> <Text variant="bodyMd" as="span" tone="subdued">/month</Text>
                                            </Text>
                                        </BlockStack>

                                        <Box paddingBlockStart="200" paddingBlockEnd="200">
                                            <Button variant="primary" fullWidth>Upgrade to Premium</Button>
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
                                                <List.Item>Video & Reels Support</List.Item>
                                                <List.Item>Priority Support</List.Item>
                                            </List>
                                        </BlockStack>
                                    </BlockStack>
                                </Card>
                            </Grid.Cell>
                        </Grid>
                    </div>
                </Layout.Section>
            </Layout >
        </Page >
    );
}
