import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.test.js"],
    env: {
      // Run the suite under a deliberately far-from-UTC zone (UTC+14). Any code
      // that reaches for local time instead of UTC produces a visibly wrong
      // day here, which is exactly the bug the analytics tests guard against.
      TZ: "Pacific/Kiritimati",
    },
  },
});
