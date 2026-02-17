import { authenticate, BILLING_IS_TEST, PREMIUM_PLAN } from "../shopify.server";

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
        const message = encodeURIComponent(
            error?.message || "Could not start billing flow. Please try again."
        );
        return redirect(`/app/plans?billing_error=${message}`);
    }
};

export default function PlansSubscribeRoute() {
    return null;
}
