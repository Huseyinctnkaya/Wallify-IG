import { json } from "@remix-run/node";
import { handleTrackingRequest } from "../utils/tracking.server";

export const action = async ({ request }) => {
    return handleTrackingRequest(request);
};

export const loader = async ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    if (type) {
        return handleTrackingRequest(request);
    }

    return json({ message: "Tracking API is active" });
};
