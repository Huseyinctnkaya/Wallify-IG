/**
 * Check if a shop has premium features enabled
 *
 * Phase 1: Returns false (features disabled, UI ready for later integration)
 * Phase 2: Can be integrated with Shopify Billing API for subscription checking
 *
 * @param {string} shop - Shop domain
 * @returns {Promise<boolean>} True if shop has premium access
 */
export async function isPremiumShop(shop) {
  // Phase 1: All features disabled initially
  // Premium UI will be ready but buttons will be disabled
  // This allows for easy activation later via Shopify Billing API

  // Future implementation example:
  // const subscription = await checkShopifyBilling(shop);
  // return subscription?.status === "ACTIVE";

  return false;
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
    plan: isPremium ? "premium" : "free",
    features: {
      pinPosts: isPremium,
      hidePosts: isPremium,
      attachProducts: isPremium,
      advancedAnalytics: isPremium,
    },
  };
}
