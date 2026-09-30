/** @type {import('@react-router/dev/config').Config} */
export default {
  appDirectory: "app",
  // Shopify embedded apps are server-rendered: the Admin needs a real document
  // response carrying the App Bridge headers on every navigation.
  ssr: true,

  // React Router 7 rejects action submissions whose Origin header does not
  // match the request URL, which breaks this app in two separate ways.
  //
  // The admin UI runs in an iframe served by the Shopify admin, so its
  // submissions are genuinely cross-origin and always will be.
  //
  // The app's own host is listed too, because behind the nginx proxy the
  // server sees `http://wallifyig.app` (TLS terminates at nginx, and
  // react-router-serve offers no way to trust X-Forwarded-Proto) while the
  // browser sends `https://wallifyig.app`. The protocols differ, so even
  // same-origin submissions fail the check.
  //
  // This only relaxes an origin check: every action still calls
  // authenticate.admin, which requires a valid Shopify session token, and
  // that remains the actual authorization gate.
  allowedActionOrigins: [
    "admin.shopify.com",
    "*.myshopify.com",
    "wallifyig.app",
  ],
};
