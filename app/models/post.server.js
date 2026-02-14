import { prisma } from "../db.server";

/**
 * Get a single post by shop and mediaId
 */
export async function getPost(shop, mediaId) {
  try {
    return await prisma.post.findUnique({
      where: {
        shop_mediaId: {
          shop,
          mediaId,
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch post:", error);
    return null;
  }
}

/**
 * Get all posts for a shop
 */
export async function getPosts(shop) {
  try {
    return await prisma.post.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch posts:", error);
    return [];
  }
}

/**
 * Toggle pin status for a post
 */
export async function togglePin(shop, mediaId) {
  try {
    const existing = await prisma.post.findUnique({
      where: {
        shop_mediaId: {
          shop,
          mediaId,
        },
      },
    });

    return await prisma.post.upsert({
      where: {
        shop_mediaId: {
          shop,
          mediaId,
        },
      },
      update: {
        isPinned: !existing?.isPinned,
        updatedAt: new Date(),
      },
      create: {
        shop,
        mediaId,
        isPinned: true,
      },
    });
  } catch (error) {
    console.error("Failed to toggle pin:", error);
    throw error;
  }
}

/**
 * Toggle hide status for a post
 */
export async function toggleHide(shop, mediaId) {
  try {
    const existing = await prisma.post.findUnique({
      where: {
        shop_mediaId: {
          shop,
          mediaId,
        },
      },
    });

    return await prisma.post.upsert({
      where: {
        shop_mediaId: {
          shop,
          mediaId,
        },
      },
      update: {
        isHidden: !existing?.isHidden,
        updatedAt: new Date(),
      },
      create: {
        shop,
        mediaId,
        isHidden: true,
      },
    });
  } catch (error) {
    console.error("Failed to toggle hide:", error);
    throw error;
  }
}

/**
 * Update products attached to a post
 * @param {string} shop - Shop domain
 * @param {string} mediaId - Instagram media ID
 * @param {Array} products - Array of product objects {id, title, image}
 */
export async function updateProducts(shop, mediaId, products) {
  try {
    const productsJson = JSON.stringify(products);

    return await prisma.post.upsert({
      where: {
        shop_mediaId: {
          shop,
          mediaId,
        },
      },
      update: {
        products: productsJson,
        updatedAt: new Date(),
      },
      create: {
        shop,
        mediaId,
        products: productsJson,
      },
    });
  } catch (error) {
    console.error("Failed to update products:", error);
    throw error;
  }
}

/**
 * Delete a post (cleanup)
 */
export async function deletePost(shop, mediaId) {
  try {
    return await prisma.post.delete({
      where: {
        shop_mediaId: {
          shop,
          mediaId,
        },
      },
    });
  } catch (error) {
    console.error("Failed to delete post:", error);
    return null;
  }
}
