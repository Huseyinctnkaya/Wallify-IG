import { json } from "@remix-run/node";
import { useState } from "react";
import {
    Page,
    Layout,
    Card,
    BlockStack,
    Text,
    Button,
    InlineStack,
    Icon,
    Collapsible,
    Box,
} from "@shopify/polaris";
import { EmailIcon, QuestionCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
    await authenticate.admin(request);
    return json({});
};

export default function Support() {
    const [openFAQ, setOpenFAQ] = useState(null);

    const toggleFAQ = (index) => {
        setOpenFAQ(openFAQ === index ? null : index);
    };

    const faqs = [
        {
            question: "How do I connect my Instagram account?",
            answer: "Go to the Dashboard, add your Instagram credentials to the .env file (INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_ACCESS_TOKEN), then click 'Connect Instagram' button."
        },
        {
            question: "My feed is not showing on the storefront, what should I do?",
            answer: "1. Make sure you've connected your Instagram account. 2. Click 'Sync Media' on the Dashboard to sync your posts. 3. Go to your theme editor and add the Instagram Feed block to your desired page."
        },
        {
            question: "How can I use Premium features?",
            answer: "Premium features (Pin posts, Hide posts, Attach products, Advanced analytics) are currently disabled in the free plan. They will be available when you upgrade to the Premium plan."
        },
        {
            question: "How do I manage my posts?",
            answer: "Go to the 'Posts & Reels' page to see all your Instagram posts. With Premium, you can pin posts (to feature them), hide posts (to remove from storefront), and attach Shopify products to posts."
        },
        {
            question: "How do carousel posts work?",
            answer: "Carousel posts (posts with multiple images) show only the first image in the feed. When you click on them, a popup opens where you can navigate through all images using arrows and dots."
        },
        {
            question: "Can I customize the feed appearance?",
            answer: "Yes! Go to Settings to customize: feed type (slider/grid), colors, spacing, border radius, number of columns, and more. Changes are reflected in the preview and on your storefront."
        },
        {
            question: "How does the 'Show pinned reels only' setting work?",
            answer: "When enabled, only posts you've pinned will be displayed on the storefront. This is useful for featuring specific content. Note: This setting only affects the storefront, not the Posts management page."
        },
        {
            question: "What analytics are available?",
            answer: "The Analytics page shows: total views and clicks, click-through rate, total engagement, week-over-week changes, last 7 days activity chart, and top performing posts with detailed metrics."
        }
    ];

    return (
        <Page title="Support" narrowWidth>
            <Layout>
                {/* Contact Support Card */}
                <Layout.Section>
                    <Card>
                        <BlockStack gap="400">
                            <InlineStack align="space-between" blockAlign="start">
                                <BlockStack gap="200">
                                    <InlineStack gap="200" blockAlign="center">
                                        <Icon source={EmailIcon} tone="base" />
                                        <Text variant="headingMd" as="h2">
                                            Contact Support
                                        </Text>
                                    </InlineStack>
                                    <Text variant="bodyMd" as="p" tone="subdued">
                                        Need help? Our support team is here to assist you with any questions or issues.
                                    </Text>
                                </BlockStack>
                                <Button
                                    variant="primary"
                                    url="mailto:support@34devs.com"
                                    external
                                >
                                    Email Support
                                </Button>
                            </InlineStack>

                            <Box paddingBlockStart="200">
                                <BlockStack gap="200">
                                    <Text variant="bodyMd" as="p">
                                        📧 <strong>Email:</strong> support@34devs.com
                                    </Text>
                                    <Text variant="bodyMd" as="p">
                                        ⏰ <strong>Response time:</strong> Within 24 hours
                                    </Text>
                                    <Text variant="bodyMd" as="p">
                                        🌐 <strong>Website:</strong>{" "}
                                        <a href="https://34devs.com" target="_blank" rel="noopener noreferrer">
                                            www.34devs.com
                                        </a>
                                    </Text>
                                </BlockStack>
                            </Box>
                        </BlockStack>
                    </Card>
                </Layout.Section>

                {/* FAQ Section */}
                <Layout.Section>
                    <Card>
                        <BlockStack gap="400">
                            <InlineStack gap="200" blockAlign="center">
                                <Icon source={QuestionCircleIcon} tone="base" />
                                <Text variant="headingMd" as="h2">
                                    Frequently Asked Questions
                                </Text>
                            </InlineStack>

                            <BlockStack gap="300">
                                {faqs.map((faq, index) => (
                                    <Box
                                        key={index}
                                        padding="300"
                                        background="bg-surface-secondary"
                                        borderRadius="200"
                                    >
                                        <BlockStack gap="200">
                                            <Button
                                                variant="plain"
                                                textAlign="left"
                                                onClick={() => toggleFAQ(index)}
                                                fullWidth
                                            >
                                                <InlineStack align="space-between" blockAlign="center">
                                                    <Text variant="headingSm" as="h3">
                                                        {faq.question}
                                                    </Text>
                                                    <Text variant="headingSm" as="span">
                                                        {openFAQ === index ? "−" : "+"}
                                                    </Text>
                                                </InlineStack>
                                            </Button>

                                            <Collapsible
                                                open={openFAQ === index}
                                                id={`faq-${index}`}
                                                transition={{ duration: "200ms", timingFunction: "ease-in-out" }}
                                            >
                                                <Box paddingBlockStart="200">
                                                    <Text variant="bodyMd" as="p" tone="subdued">
                                                        {faq.answer}
                                                    </Text>
                                                </Box>
                                            </Collapsible>
                                        </BlockStack>
                                    </Box>
                                ))}
                            </BlockStack>
                        </BlockStack>
                    </Card>
                </Layout.Section>

                {/* Additional Resources */}
                <Layout.Section>
                    <Card>
                        <BlockStack gap="300">
                            <Text variant="headingMd" as="h2">
                                Additional Resources
                            </Text>
                            <Text variant="bodyMd" as="p" tone="subdued">
                                Still have questions? Check out these helpful resources:
                            </Text>
                            <BlockStack gap="200">
                                <Button variant="plain" url="/app">
                                    → Dashboard & Settings Guide
                                </Button>
                                <Button variant="plain" url="/app/posts">
                                    → Managing Posts & Reels
                                </Button>
                                <Button variant="plain" url="/app/analytics">
                                    → Understanding Analytics
                                </Button>
                                <Button variant="plain" url="/app/plans">
                                    → Premium Features & Plans
                                </Button>
                            </BlockStack>
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
