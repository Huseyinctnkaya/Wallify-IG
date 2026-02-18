import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  try {
    const { payload, shop } = await authenticate.webhook(request);
    const currentScope = Array.isArray(payload?.current)
      ? payload.current.join(",")
      : String(payload?.current ?? "");

    // Ack webhook quickly, then update all sessions for this shop in background.
    if (currentScope) {
      void db.session
        .updateMany({
          where: { shop },
          data: { scope: currentScope },
        })
        .catch((error) => {
          console.error("Failed to update scope after APP_SCOPES_UPDATE", {
            shop,
            error,
          });
        });
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Failed to process APP_SCOPES_UPDATE webhook", error);
    return new Response("Unauthorized", { status: 401 });
  }
};
