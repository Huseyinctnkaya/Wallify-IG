/** @type {import('@react-router/dev/config').Config} */
export default {
  appDirectory: "app",
  // Shopify embedded apps are server-rendered: the Admin needs a real document
  // response carrying the App Bridge headers on every navigation.
  ssr: true,
};
