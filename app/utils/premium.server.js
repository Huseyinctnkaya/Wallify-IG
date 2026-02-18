import { PREMIUM_PLAN } from "../shopify.server";

function isForcedPremiumInDevelopment() {
  if (process.env.FORCE_DEV_PREMIUM === "true") return true;
  return process.env.NODE_ENV !== "production" && process.env.FORCE_DEV_PREMIUM !== "false";
}

/**
 * Check if a shop has premium features enabled via Shopify Billing API
 *
 * @param {string} shop - Shop domain
 * @param {object} [admin] - Shopify admin GraphQL client (optional)
 * @returns {Promise<boolean>} True if shop has premium access
 */
export async function isPremiumShop(shop, admin) {
  if (isForcedPremiumInDevelopment()) return true;
  if (!admin) return false;

  try {
    const response = await admin.graphql(`
      query {
        currentAppInstallation {
          activeSubscriptions {
            name
            status
          }
        }
      }
    `);

    const data = await response.json();
    const subscriptions = data?.data?.currentAppInstallation?.activeSubscriptions || [];

    return subscriptions.some(
      (sub) => sub.name === PREMIUM_PLAN && sub.status === "ACTIVE"
    );
  } catch (error) {
    console.error("Failed to check premium status:", error);
    return false;
  }
}

/**
 * Get premium plan details for a shop
 *
 * @param {string} shop - Shop domain
 * @param {object} [admin] - Shopify admin GraphQL client (optional)
 * @returns {Promise<Object>} Plan details
 */
export async function getPremiumPlanDetails(shop, admin) {
  const isPremium = await isPremiumShop(shop, admin);
  return {
    isPremium,
    plan: isPremium ? "premium" : "basic",
    features: {
      pinPosts: isPremium,
      hidePosts: isPremium,
      attachProducts: isPremium,
      advancedAnalytics: isPremium,
    },
  };
}
