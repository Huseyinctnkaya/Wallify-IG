/**
 * Shared helpers for writing the app's shop-owned metafields.
 *
 * Every metafield write needs the shop's GID as `ownerId`. The value is NOT
 * cached at module scope: one Node process serves every shop that has the app
 * installed, so a process-wide cache would write shop A's GID into shop B's
 * mutation. Batch writes through `setShopMetafields` instead — one lookup and
 * one mutation per call, however many metafields you pass.
 */

export const METAFIELD_NAMESPACE = "instagram_feed";

export async function getShopGid(admin) {
  const response = await admin.graphql(`#graphql
    query ShopGid {
      shop {
        id
      }
    }
  `);
  const result = await response.json();

  const shopId = result?.data?.shop?.id;
  if (!shopId) {
    throw new Error(
      `Could not resolve shop ID: ${result?.errors?.[0]?.message ?? "unexpected Admin API response"}`,
    );
  }

  return shopId;
}

/**
 * Write one or more metafields and surface userErrors as a thrown Error.
 *
 * @param {object} admin - Shopify admin GraphQL client
 * @param {Array<{namespace?: string, key: string, type: string, value: string}>} metafields
 *   `namespace` defaults to the app namespace; `ownerId` is always the shop GID.
 */
export async function setShopMetafields(admin, metafields) {
  if (!metafields.length) return null;

  const ownerId = await getShopGid(admin);
  const payload = metafields.map((metafield) => ({
    namespace: METAFIELD_NAMESPACE,
    ...metafield,
    ownerId,
  }));

  const response = await admin.graphql(
    `#graphql
    mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          namespace
        }
        userErrors {
          field
          message
        }
      }
    }`,
    { variables: { metafields: payload } },
  );

  const result = await response.json();

  if (!result?.data?.metafieldsSet) {
    throw new Error(
      `metafieldsSet failed: ${result?.errors?.[0]?.message ?? "unexpected Admin API response"}`,
    );
  }

  const { userErrors } = result.data.metafieldsSet;
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((e) => e.message).join("; "));
  }

  return result.data.metafieldsSet;
}
