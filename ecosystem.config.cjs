/**
 * PM2 process definition for the production deployment.
 *
 * Deliberately contains no secrets. Node 22's --env-file reads them from .env
 * at startup, which keeps them in a single 0600 file instead of duplicated
 * into a PM2 config that ends up world-readable.
 *
 * PM2's own `env` below still wins over anything in .env (process environment
 * takes precedence over --env-file), so the two sets are kept disjoint: only
 * operational values here, only secrets and DATABASE_URL in .env.
 *
 * Start with `pm2 start ecosystem.config.cjs` from the application directory.
 *
 * Note this runs the server binary directly rather than `npm start`. Going
 * through npm adds a shell wrapper that PM2 cannot supervise reliably, and
 * `npm run docker-start` in particular would re-run database migrations on
 * every restart -- that script is the Docker entrypoint, not a PM2 one.
 */
module.exports = {
  apps: [
    {
      name: "wallifyig",
      cwd: __dirname,
      script: "./node_modules/.bin/react-router-serve",
      args: "./build/server/index.js",
      interpreter: "node",
      interpreter_args: "--env-file=.env",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      // The host is memory-constrained and shared with several other apps;
      // restart rather than let this one drive the box into swap.
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        // nginx proxies wallifyig.app to 127.0.0.1:3000.
        PORT: 3000,
      },
    },
  ],
};
