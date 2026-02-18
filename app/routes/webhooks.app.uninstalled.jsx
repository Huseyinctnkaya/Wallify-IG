import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  try {
    const { shop } = await authenticate.webhook(request);

    // Webhook requests can trigger multiple times. Cleanup is idempotent.
    void db.session.deleteMany({ where: { shop } }).catch((error) => {
      console.error("Failed to cleanup sessions after APP_UNINSTALLED", {
        shop,
        error,
      });
    });

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Failed to process APP_UNINSTALLED webhook", error);
    return new Response("Unauthorized", { status: 401 });
  }
};
