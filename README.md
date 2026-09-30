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
