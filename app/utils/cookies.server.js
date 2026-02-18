import { createCookie } from "@remix-run/node";

export const igAuthShopCookie = createCookie("ig_auth_shop", {
    maxAge: 600, // 10 minutes
    httpOnly: true,
    secure: true,
    sameSite: "lax",
});
