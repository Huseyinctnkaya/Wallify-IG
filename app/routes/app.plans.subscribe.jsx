import { authenticate, BILLING_IS_TEST, PREMIUM_PLAN } from "../shopify.server";

function extractBillingErrorMessage(error) {
    const baseMessage = String(error?.message || "Could not start billing flow. Please try again.");
    const errorData = error?.errorData;

    if (Array.isArray(errorData) && errorData.length > 0) {
        const detailed = errorData
            .map((item) => item?.message || item?.toString?.())
            .filter(Boolean)
            .join(" | ");

        if (detailed) {
            return `${baseMessage}: ${detailed}`;
        }
    }

    return baseMessage;
}

export const loader = async ({ request }) => {
    const { billing, redirect } = await authenticate.admin(request);

    const appUrl = process.env.SHOPIFY_APP_URL?.replace(/\/$/, "");
    const returnUrl = appUrl ? `${appUrl}/app/plans` : "/app/plans";

    try {
        await billing.require({
            plans: [PREMIUM_PLAN],
            isTest: BILLING_IS_TEST,
            onFailure: async () =>
                billing.request({
                    plan: PREMIUM_PLAN,
                    isTest: BILLING_IS_TEST,
                    returnUrl,
                }),
        });

        return redirect("/app/plans");
    } catch (error) {
        if (error instanceof Response) {
            throw error;
        }

        console.error("Billing subscribe flow failed:", error);
        const message = encodeURIComponent(extractBillingErrorMessage(error).slice(0, 800));
        return redirect(`/app/plans?billing_error=${message}`);
    }
};

export default function PlansSubscribeRoute() {
    return null;
}
