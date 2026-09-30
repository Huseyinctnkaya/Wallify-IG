# Wallify IG - Instagram Feed for Shopify

Wallify IG helps you display Instagram content on your Shopify store as a modern feed.  
Goal: increase social proof, improve product discovery, and keep your storefront visually fresh.

## What it does

- Connects your Instagram account and brings your posts into your store.
- Works as a Shopify `App Block`, no coding required.
- Lets you control feed settings from the app dashboard and reflect changes on the storefront.

## Key features

- Instagram Business/Creator connection
- One-click media sync
- Slider and Grid feed layouts
- Mobile-friendly storefront display
- Step-by-step Setup Guide
- Post/Reel management (pin, hide, etc.)
- Click and view tracking (Analytics)
- Advanced capabilities with the Premium plan

## Running it locally

Requires Node >= 22.12 and a PostgreSQL database.

```bash
cp .env.example .env          # then fill in DATABASE_URL and the Meta app keys
npm install
npx prisma migrate deploy     # creates the schema
npm run dev                   # shopify app dev
```

`DATABASE_URL` is required — there is no SQLite fallback. For a throwaway local
database: `createdb wallify_ig_dev`.

## Quick setup flow

1. Open the app and connect your Instagram account.
2. Run `Sync Media` to fetch your posts.
3. Add the `Instagram Feed` app block in the Shopify Theme Editor.
4. Customize title, layout, button text, and colors from the dashboard.

## Plans

- **Free:** ideal for basic feed usage and getting started.
- **Premium:** advanced display, filtering, analytics, and additional features.

## Deployment

Runs on an IONOS VPS (`curved-london`) that also hosts several other apps, so
nothing here should assume exclusive use of the machine.

| | |
|---|---|
| Process manager | PM2, under the `huseyin` daemon (`pm2-huseyin.service`) |
| Config | `ecosystem.config.cjs` — no secrets; Node's `--env-file` reads `.env` (mode 0600) |
| Port | 3000, proxied by nginx from `wallifyig.app` |
| TLS | Let's Encrypt, renewed by `certbot.timer` |
| Database | PostgreSQL 14 on `127.0.0.1:5432`, database `wallifyig` |

**Build locally, not on the server.** The host has ~1.8 GB of RAM shared with
nine other apps and is already into swap; a Vite build there risks pushing the
box over. Deploy looks like this:

```bash
# On your machine
npm run build
rsync -az --delete --stats build/ volera:/home/huseyin/wallifyig-app/build/

# On the server
ssh volera
cd /home/huseyin/wallifyig-app
sudo -u huseyin git pull origin main
sudo -u huseyin npm ci --omit=dev          # only if dependencies changed
sudo -u huseyin npx prisma generate
sudo -u huseyin npx prisma migrate deploy  # only if migrations were added
sudo -u huseyin -H env HOME=/home/huseyin pm2 restart wallifyig
```

Check `rsync --stats` actually reports transferred files. A filtered or silent
rsync that copies nothing looks identical to success from the file listing
afterwards, and the app will keep serving the previous build.

Config and extension changes need a separate `shopify app deploy` — updating
the server does not touch what merchants' storefronts load.

Logs: `pm2 logs wallifyig`, or `~/.pm2/logs/wallifyig-{out,error}-<id>.log`.
Note the id suffix changes every time the process is recreated, so check
`pm2 describe wallifyig` for the current paths rather than reading the
unsuffixed files, which are stale.

## Migrating an existing SQLite database

The app used to run on a SQLite file and now requires PostgreSQL. If a
deployment has live data, copy it over before cutting traffic across, otherwise
every merchant loses their Instagram connection, settings and analytics.

```bash
# 1. Point at the new database and create the schema.
export DATABASE_URL="postgresql://..."
npx prisma migrate deploy

# 2. Check what would move, without writing.
node scripts/migrate-sqlite-to-postgres.js ./prisma/dev.sqlite \
  --source-timezone Europe/Istanbul --dry-run

# 3. Run it for real.
node scripts/migrate-sqlite-to-postgres.js ./prisma/dev.sqlite \
  --source-timezone Europe/Istanbul
```

**`--source-timezone` is the timezone the OLD server ran in, and getting it
wrong shifts every daily total by a day.** `Analytics.date` used to be written
as local midnight, so its meaning depends on the writer's timezone: a row from
a UTC+3 container reads as 21:00 the previous day if interpreted as UTC. The
default is `UTC`; pass the real zone if the old deployment used anything else.

The script is idempotent — every write is an upsert on the same unique keys the
app uses — so a partial run can simply be repeated. Rows that collapse onto one
UTC day after conversion are summed, not overwritten, and it reports when that
happens.

## Stack

| | |
|---|---|
| Framework | React Router 7 (the project migrated off Remix v2) |
| Shopify SDK | `@shopify/shopify-app-react-router` |
| Admin API | 2026-07 — set once as `API_VERSION` in `app/shopify.server.js`; `shopify.app.toml` and `.graphqlrc.js` must match |
| UI | Polaris React 13 + App Bridge 4 |
| Database | PostgreSQL via Prisma |
| Build | Vite 8 |

Version ceilings are set by Shopify's own peer dependencies, not by choice:
`@shopify/shopify-app-react-router` pins `react-router@^7`, Polaris 13 pins
`react@^18`, and `@shopify/shopify-app-session-storage-prisma@11` pins
`prisma@^6`. React 19, React Router 8 and Prisma 7 are all blocked until
Shopify moves.

## Known issues

- **Polaris React is deprecated.** Shopify has stopped maintaining it in favour
  of Polaris web components. 13.9.5 is the end of the line; a future UI rewrite
  is unavoidable.
- **`npm audit` reports 9 high advisories**, all in the `@graphql-codegen`
  chain under `@shopify/api-codegen-preset`. That is a devDependency: it never
  ships, and it only runs on a manual `npm run graphql-codegen`. It is kept for
  GraphQL autocomplete in the editor via `.graphqlrc.js`. Nothing in the app
  imports generated types — the project is plain JavaScript — so the preset can
  be dropped outright if the editor support is not wanted.
- **Four `react-hooks/set-state-in-effect` warnings** on the auto-dismissing
  banners in `app._index.jsx` and `app.posts.jsx`. Pre-existing; fixing them
  changes the fade animation, so it is tracked rather than rushed.

## Support

You can contact support from the **Contact** page inside the app.
