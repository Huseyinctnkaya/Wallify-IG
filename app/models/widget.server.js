import { prisma } from "../db.server";

// Default configuration for new widgets
const DEFAULT_CONFIG = {
    layout: "grid", // grid, carousel
    columnsDesktop: 4,
    columnsMobile: 2,
    gap: 10,
    limit: 8,
    showTitle: true,
    title: "Follow us on Instagram",
    description: "Join our community for daily inspiration",
    showButton: true,
    buttonText: "Follow on Instagram",
    buttonUrl: "https://instagram.com",
    overlay: true, // Show overlay on hover
};

/**
 * Get all widgets for a shop
 */
export async function getWidgets(shop) {
    return prisma.widget.findMany({
        where: { shop },
        orderBy: { createdAt: "desc" },
    });
}

/**
 * Get a single widget by ID
 */
export async function getWidget(id) {
    return prisma.widget.findUnique({
        where: { id },
    });
}

/**
 * Create a new widget with default settings
 */
export async function createWidget(shop, title = "My Feed Widget") {
    return prisma.widget.create({
        data: {
            shop,
            title,
            configuration: JSON.stringify(DEFAULT_CONFIG),
        },
    });
}

/**
 * Update widget configuration
 */
export async function updateWidget(id, data) {
    const { title, configuration, status } = data;

    return prisma.widget.update({
        where: { id },
        data: {
            ...(title && { title }),
            ...(configuration && { configuration: typeof configuration === 'string' ? configuration : JSON.stringify(configuration) }),
            ...(status && { status }),
        },
    });
}

/**
 * Delete a widget
 */
export async function deleteWidget(id) {
    return prisma.widget.delete({
        where: { id },
    });
}

/**
 * Publish widget (Save to Metafields)
 * This makes the widget configurations available to different theme blocks
 * We'll use a JSON metafield where keys are widget IDs
 */
export async function publishWidget(admin, widget) {
    // First, get existing widgets data from metafield
    // In a real multi-widget scenario, you might want to store all active widgets in one metafield
    // or use separate metafields per widget.
    // For simplicity, let's store an array of active widgets.

    // For now, we will just update the 'active' widget configuration
    // But ideally, the liquid block would take a widget ID setting.

    const jsonValue = JSON.stringify(JSON.parse(widget.configuration));

    const response = await admin.graphql(
        `#graphql
        mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
                metafields {
                    key
                    namespace
                    value
                }
                userErrors {
                    field
                    message
                }
            }
        }`,
        {
            variables: {
                metafields: [
                    {
                        namespace: "instagram_feed",
                        key: "widget_config", // Main active config
                        type: "json",
                        value: jsonValue,
                        ownerId: (await getShopId(admin))
                    }
                ]
            },
        }
    );

    return response.json();
}

async function getShopId(admin) {
    const response = await admin.graphql(`query { shop { id } }`);
    const data = await response.json();
    return data.data.shop.id;
}
