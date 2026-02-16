/**
 * Check if a shop has premium features enabled
 *
 * Current behavior:
 * - FORCE_PREMIUM_PLAN=true => all shops are premium
 * - PREMIUM_SHOPS="shop1.myshopify.com,shop2.myshopify.com" => listed shops are premium
 * - fallback => basic plan
 *
 * @param {string} shop - Shop domain
 * @returns {Promise<boolean>} True if shop has premium access
 */
export async function isPremiumShop(shop) {
  const forcePremium = process.env.FORCE_PREMIUM_PLAN === "true";
  if (forcePremium) return true;

  const premiumShops = (process.env.PREMIUM_SHOPS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (!shop) return false;
  return premiumShops.includes(shop.toLowerCase());
}

/**
 * Get premium plan details for a shop
 * Placeholder for future billing integration
 *
 * @param {string} shop - Shop domain
 * @returns {Promise<Object>} Plan details
 */
export async function getPremiumPlanDetails(shop) {
  const isPremium = await isPremiumShop(shop);
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
