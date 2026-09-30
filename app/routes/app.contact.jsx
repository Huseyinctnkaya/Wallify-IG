import { useState } from "react";
import {
    Page,
    Layout,
    Card,
    BlockStack,
    InlineStack,
    Text,
    Button,
    Link,
    Icon,
    Collapsible,
    Divider,
    Box,
} from "@shopify/polaris";
import { ClockIcon, EmailIcon, GlobeIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

const SUPPORT_EMAIL = "info@34devs.com";
const WEBSITE = "landing.wallifyig.app";

export const loader = async ({ request }) => {
    await authenticate.admin(request);
    return {};
};

// Kept in sync with the actual UI labels: the wording here is what a merchant
// has to find on screen, so it should match the buttons exactly.
const FAQS = [
    {
        question: "How do I connect my Instagram account?",
        answer:
            "Open the Dashboard and click “Connect Instagram account”. You will be sent to Instagram to authorize access. Note that Instagram only allows Business and Creator accounts to be connected — personal accounts will not work.",
    },
    {
        question: "My feed is not showing on my storefront",
        answer:
            "Three things need to be in place. First, your Instagram account has to be connected on the Dashboard. Second, click “Sync Media” so your posts are pulled in. Third, open your theme editor and add the “Instagram Feed” block to the page where you want it — the app cannot place it for you. The Dashboard’s setup guide tracks all three and shows which step is still missing.",
    },
    {
        question: "Where do I change how the feed looks?",
        answer:
            "Everything is on the Dashboard, below the setup guide: feed type (slider or grid), column counts for desktop and mobile, spacing, corner radius, button text and colors. The preview updates as you edit, and saving pushes the change to your storefront.",
    },
    {
        question: "How do I manage individual posts?",
        answer:
            "The “Posts & Reels” page lists everything pulled in from Instagram. On the Premium plan you can pin a post so it appears first, hide one so it never reaches your storefront, and attach Shopify products to a post so shoppers can buy what they see.",
    },
    {
        question: "What does Premium include, and what does it cost?",
        answer:
            "Premium is $2.99 per month and adds pinning, hiding, attaching products to posts, and the full analytics breakdown. Everything else — connecting Instagram, syncing, both feed layouts and all the styling options — works on the free plan. You can subscribe or cancel any time from the Plans page.",
    },
    {
        question: "How do posts with multiple images behave?",
        answer:
            "A carousel post shows its first image in the feed. Clicking it opens a popup where shoppers can move through the rest with the arrows or the dots.",
    },
    {
        question: "What does “Show pinned reels only” do?",
        answer:
            "It limits your storefront feed to the posts you have pinned, which is useful when you want to feature a specific set rather than your latest posts. It changes the storefront only — the “Posts & Reels” page still lists everything.",
    },
    {
        question: "What is on the Analytics page?",
        answer:
            "Views, clicks and click-through rate for your feed, how each compares with the previous week, a chart of the last seven days, and a ranking of which posts are actually getting clicked.",
    },
];

function ContactRow({ icon, label, children }) {
    return (
        <InlineStack gap="300" blockAlign="center" wrap={false} align="start">
            {/* Icon carries `margin: auto`, which as a bare flex child absorbs
                all the free space in the row and shoves the text to the far
                edge. Polaris uses it inside components that already box the
                icon in; here it needs an explicit box of its own. */}
            <Box width="1.25rem">
                <Icon source={icon} tone="subdued" />
            </Box>
            <BlockStack gap="050">
                <Text variant="bodySm" as="h3" tone="subdued">
                    {label}
                </Text>
                {children}
            </BlockStack>
        </InlineStack>
    );
}

function FaqItem({ faq, index, isOpen, onToggle }) {
    const contentId = `faq-panel-${index}`;

    return (
        <BlockStack gap="200">
            {/* The heading wraps the button rather than sitting inside it: a
                heading nested in a button is invalid, and screen readers need
                the questions to show up in the document outline. */}
            <Text as="h3" variant="headingSm">
                <Button
                    variant="tertiary"
                    textAlign="left"
                    fullWidth
                    disclosure={isOpen ? "up" : "down"}
                    ariaExpanded={isOpen}
                    ariaControls={contentId}
                    onClick={onToggle}
                >
                    {faq.question}
                </Button>
            </Text>

            <Collapsible
                open={isOpen}
                id={contentId}
                transition={{ duration: "200ms", timingFunction: "ease-in-out" }}
            >
                <Box paddingInlineStart="300" paddingBlockEnd="200">
                    <Text variant="bodyMd" as="p" tone="subdued">
                        {faq.answer}
                    </Text>
                </Box>
            </Collapsible>
        </BlockStack>
    );
}

export default function Contact() {
    const [openFAQ, setOpenFAQ] = useState(null);

    return (
        // Two columns: the FAQ carries the bulk of the page, so it takes the
        // primary section, and the contact details sit in the sidebar. Polaris
        // Layout wraps them back into one column when the viewport is too
        // narrow, so no breakpoint handling is needed here.
        <Page title="Contact & support">
            <Layout>
                <Layout.Section>
                    <Card>
                        <BlockStack gap="400">
                            <Text variant="headingMd" as="h2">
                                Frequently asked questions
                            </Text>

                            <BlockStack gap="300">
                                {FAQS.map((faq, index) => (
                                    <BlockStack key={faq.question} gap="300">
                                        {index > 0 && <Divider />}
                                        <FaqItem
                                            faq={faq}
                                            index={index}
                                            isOpen={openFAQ === index}
                                            onToggle={() =>
                                                setOpenFAQ(openFAQ === index ? null : index)
                                            }
                                        />
                                    </BlockStack>
                                ))}
                            </BlockStack>
                        </BlockStack>
                    </Card>
                </Layout.Section>

                <Layout.Section variant="oneThird">
                    <Card>
                        <BlockStack gap="400">
                            <BlockStack gap="100">
                                <Text variant="headingMd" as="h2">
                                    Get in touch
                                </Text>
                                <Text variant="bodyMd" as="p" tone="subdued">
                                    Tell us your store URL and what you were doing when the
                                    problem happened — it saves a round trip.
                                </Text>
                            </BlockStack>

                            <BlockStack gap="400">
                                <ContactRow icon={EmailIcon} label="Email">
                                    <Link url={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</Link>
                                </ContactRow>

                                <ContactRow icon={ClockIcon} label="Response time">
                                    <Text variant="bodyMd" as="p">
                                        Within 24 hours on business days
                                    </Text>
                                </ContactRow>

                                <ContactRow icon={GlobeIcon} label="Website">
                                    <Link url={`https://${WEBSITE}/`} target="_blank">
                                        {WEBSITE}
                                    </Link>
                                </ContactRow>
                            </BlockStack>

                            <Button variant="primary" url={`mailto:${SUPPORT_EMAIL}`} external>
                                Email support
                            </Button>
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
