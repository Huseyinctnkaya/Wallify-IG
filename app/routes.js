import { flatRoutes } from "@react-router/fs-routes";

// Colocated test files must be excluded explicitly: anything under app/routes
// is otherwise treated as a route and pulled into the server bundle, which
// then tries to import vitest at runtime and fails on a production install.
export default flatRoutes({
  ignoredRouteFiles: ["**/*.test.{js,jsx}", "**/__tests__/**"],
});
