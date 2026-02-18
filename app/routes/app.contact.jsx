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
    Collapsible,
    Box,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
    await authenticate.admin(request);
    return json({});
};

export default function Contact() {
    const [openFAQ, setOpenFAQ] = useState(null);

    const toggleFAQ = (index) => {
        setOpenFAQ(openFAQ === index ? null : index);
    };

    const faqs = [
        {
            question: "How do I connect my Instagram account?",
            answer: "Go to the Dashboard and click 'Connect Instagram'. You will be redirected to Instagram Login to authorize your own account."
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
        <Page title="Contact & Support" narrowWidth>
            <Layout>
                {/* Contact Support Card */}
                <Layout.Section>
                    <Card>
                        <BlockStack gap="500">
                            <BlockStack gap="300">
                                <Text variant="headingLg" as="h2">
                                    Contact Support
                                </Text>
                                <Text variant="bodyMd" as="p" tone="subdued">
                                    Need help? Our support team is here to assist you with any questions or issues.
                                </Text>
                            </BlockStack>

                            <Box
                                padding="400"
                                background="bg-surface-secondary"
                                borderRadius="300"
                            >
                                <BlockStack gap="400">
                                    <InlineStack gap="300" blockAlign="center">
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '8px',
                                            background: '#f0f0f0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Text variant="headingMd" as="span">📧</Text>
                                        </div>
                                        <BlockStack gap="100">
                                            <Text variant="headingSm" as="h3">
                                                Email
                                            </Text>
                                            <Text variant="bodyMd" as="p">
                                                info@34devs.com
                                            </Text>
                                        </BlockStack>
                                    </InlineStack>

                                    <InlineStack gap="300" blockAlign="center">
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '8px',
                                            background: '#f0f0f0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Text variant="headingMd" as="span">⏰</Text>
                                        </div>
                                        <BlockStack gap="100">
                                            <Text variant="headingSm" as="h3">
                                                Response time
                                            </Text>
                                            <Text variant="bodyMd" as="p">
                                                Within 24 hours
                                            </Text>
                                        </BlockStack>
                                    </InlineStack>

                                    <InlineStack gap="300" blockAlign="center">
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '8px',
                                            background: '#f0f0f0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Text variant="headingMd" as="span">🌐</Text>
                                        </div>
                                        <BlockStack gap="100">
                                            <Text variant="headingSm" as="h3">
                                                Website
                                            </Text>
                                            <Text variant="bodyMd" as="p">
                                                <a href="https://landing.wallifyig.app/" target="_blank" rel="noopener noreferrer" style={{ color: '#005bd3', textDecoration: 'none' }}>
                                                    landing.wallifyig.app
                                                </a>
                                            </Text>
                                        </BlockStack>
                                    </InlineStack>

                                    <Box paddingBlockStart="200">
                                        <Button
                                            variant="primary"
                                            url="mailto:info@34devs.com"
                                            external
                                            fullWidth
                                        >
                                            Send Email
                                        </Button>
                                    </Box>
                                </BlockStack>
                            </Box>
                        </BlockStack>
                    </Card>
                </Layout.Section>

                {/* FAQ Section */}
                <Layout.Section>
                    <Card>
                        <BlockStack gap="500">
                            <BlockStack gap="300">
                                <Text variant="headingLg" as="h2">
                                    Frequently Asked Questions
                                </Text>
                                <Text variant="bodyMd" as="p" tone="subdued">
                                    Find answers to common questions about the Instagram Feed app.
                                </Text>
                            </BlockStack>

                            <BlockStack gap="200">
                                {faqs.map((faq, index) => (
                                    <Box
                                        key={index}
                                        padding="400"
                                        background="bg-surface-secondary"
                                        borderRadius="200"
                                    >
                                        <BlockStack gap="300">
                                            <Button
                                                variant="plain"
                                                textAlign="left"
                                                onClick={() => toggleFAQ(index)}
                                                fullWidth
                                            >
                                                <InlineStack align="space-between" blockAlign="center">
                                                    <Text variant="headingSm" as="h3" fontWeight="semibold">
                                                        {faq.question}
                                                    </Text>
                                                    <div style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '50%',
                                                        background: '#f0f0f0',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0
                                                    }}>
                                                        <Text variant="bodySm" as="span" fontWeight="semibold">
                                                            {openFAQ === index ? "−" : "+"}
                                                        </Text>
                                                    </div>
                                                </InlineStack>
                                            </Button>

                                            <Collapsible
                                                open={openFAQ === index}
                                                id={`faq-${index}`}
                                                transition={{ duration: "200ms", timingFunction: "ease-in-out" }}
                                            >
                                                <Box paddingBlockStart="100">
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

                {/* Bottom Spacing */}
                <Layout.Section>
                    <Box paddingBlockEnd="800" />
                </Layout.Section>
            </Layout>
        </Page>
    );
}
