#!/usr/bin/env node
/**
 * Copy an existing SQLite database into the PostgreSQL one.
 *
 *   node scripts/migrate-sqlite-to-postgres.js <path-to-dev.sqlite> [options]
 *
 *   --source-timezone <IANA>  Timezone the OLD server ran in. Default: UTC.
 *   --dry-run                 Report what would be written, write nothing.
 *
 * Reads with node:sqlite (built in since Node 22, no extra dependency) and
 * writes through Prisma, so the destination schema is whatever prisma/schema
 * currently defines. DATABASE_URL must point at the target database and its
 * migrations must already be applied.
 *
 * Every write is an upsert keyed on the same unique constraints the app uses,
 * so re-running is safe.
 *
 * ## Why --source-timezone matters
 *
 * Analytics.date used to be written as *local* midnight, so its value depends
 * on the timezone of the container that wrote it. A row from a UTC+3 server
 * reads as 21:00 on the previous day when interpreted as UTC. Pass the old
 * server's timezone and the calendar day is recovered correctly; guess wrong
 * and every daily total shifts by one day.
 *
 * Rows that collapse onto the same UTC day after conversion are summed rather
 * than one silently overwriting the other.
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(argv) {
  const [source, ...rest] = argv.filter((a) => !a.startsWith("--"));
  const flags = argv.filter((a) => a.startsWith("--"));
  const tzIndex = argv.indexOf("--source-timezone");
  return {
    source,
    extra: rest,
    dryRun: flags.includes("--dry-run"),
    timezone: tzIndex !== -1 ? argv[tzIndex + 1] : "UTC",
  };
}

const toBool = (v) => v === 1 || v === true || v === "1";
const toDate = (v) => (v === null || v === undefined ? null : new Date(Number(v)));

/** Calendar day the instant fell on in `timeZone`, as midnight UTC. */
function calendarDayUTC(value, timeZone) {
  const instant = new Date(Number(value));
  const [{ value: y }, , { value: m }, , { value: d }] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

function readTable(db, table) {
  try {
    return db.prepare(`SELECT * FROM "${table}"`).all();
  } catch (error) {
    if (/no such table/i.test(error.message)) {
      console.log(`  ${table}: not present in source, skipped`);
      return [];
    }
    throw error;
  }
}

async function copy(label, rows, write, { dryRun }) {
  if (!rows.length) {
    console.log(`  ${label}: 0 rows`);
    return 0;
  }
  if (dryRun) {
    console.log(`  ${label}: ${rows.length} rows (dry run, not written)`);
    return rows.length;
  }
  let written = 0;
  for (const row of rows) {
    await write(row);
    written += 1;
  }
  console.log(`  ${label}: ${written} rows`);
  return written;
}

async function main() {
  const { source, timezone, dryRun } = parseArgs(process.argv.slice(2));

  if (!source) {
    console.error("Usage: node scripts/migrate-sqlite-to-postgres.js <sqlite-file> [--source-timezone <IANA>] [--dry-run]");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set; it must point at the destination database.");
    process.exit(1);
  }
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
  } catch {
    console.error(`Unknown timezone: ${timezone}`);
    process.exit(1);
  }

  console.log(`source:      ${path.resolve(source)}`);
  console.log(`destination: ${process.env.DATABASE_URL.replace(/:\/\/[^@]*@/, "://***@")}`);
  console.log(`source timezone for Analytics.date: ${timezone}`);
  if (dryRun) console.log("DRY RUN - nothing will be written");
  console.log();

  const db = new DatabaseSync(source, { readOnly: true });

  await copy("Session", readTable(db, "Session"), (r) => {
    const record = {
      shop: r.shop,
      state: r.state,
      isOnline: toBool(r.isOnline),
      scope: r.scope,
      expires: toDate(r.expires),
      accessToken: r.accessToken,
      userId: r.userId === null ? null : BigInt(r.userId),
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      accountOwner: toBool(r.accountOwner),
      locale: r.locale,
      collaborator: r.collaborator === null ? null : toBool(r.collaborator),
      emailVerified: r.emailVerified === null ? null : toBool(r.emailVerified),
      refreshToken: r.refreshToken ?? null,
      refreshTokenExpires: toDate(r.refreshTokenExpires),
    };
    return prisma.session.upsert({
      where: { id: r.id },
      update: record,
      create: { id: r.id, ...record },
    });
  }, { dryRun });

  await copy("InstagramAccount", readTable(db, "InstagramAccount"), (r) => {
    const record = {
      accessToken: r.accessToken,
      userId: String(r.userId),
      username: r.username,
      profilePictureUrl: r.profilePictureUrl ?? null,
    };
    return prisma.instagramAccount.upsert({
      where: { shop: r.shop },
      update: record,
      create: { shop: r.shop, ...record },
    });
  }, { dryRun });

  await copy("Settings", readTable(db, "Settings"), (r) => {
    // id and updatedAt are regenerated by the destination schema.
    const { id: _id, shop, updatedAt: _updatedAt, ...rest } = r;
    const record = Object.fromEntries(
      Object.entries(rest).map(([k, v]) => [k, typeof v === "number" && isBooleanColumn(k) ? toBool(v) : v]),
    );
    return prisma.settings.upsert({
      where: { shop },
      update: record,
      create: { shop, ...record },
    });
  }, { dryRun });

  // Sum rows that land on the same day once converted out of the old local time.
  const analyticsByDay = new Map();
  for (const r of readTable(db, "Analytics")) {
    const day = calendarDayUTC(r.date, timezone);
    const key = `${r.shop}|${day.toISOString()}`;
    const acc = analyticsByDay.get(key) ?? { shop: r.shop, date: day, views: 0, clicks: 0 };
    acc.views += r.views;
    acc.clicks += r.clicks;
    analyticsByDay.set(key, acc);
  }
  const merged = [...analyticsByDay.values()];
  const collapsed = readTable(db, "Analytics").length - merged.length;
  if (collapsed > 0) {
    console.log(`  note: ${collapsed} Analytics rows merged into the same UTC day`);
  }
  await copy("Analytics", merged, (r) =>
    prisma.analytics.upsert({
      where: { shop_date: { shop: r.shop, date: r.date } },
      update: { views: r.views, clicks: r.clicks },
      create: r,
    }), { dryRun });

  await copy("PostAnalytics", readTable(db, "PostAnalytics"), (r) => {
    const record = {
      mediaUrl: r.mediaUrl,
      permalink: r.permalink,
      views: r.views,
      clicks: r.clicks,
    };
    return prisma.postAnalytics.upsert({
      where: { shop_mediaId: { shop: r.shop, mediaId: r.mediaId } },
      update: record,
      create: { shop: r.shop, mediaId: r.mediaId, ...record },
    });
  }, { dryRun });

  await copy("Post", readTable(db, "Post"), (r) => {
    const record = {
      isPinned: toBool(r.isPinned),
      isHidden: toBool(r.isHidden),
      products: r.products,
    };
    return prisma.post.upsert({
      where: { shop_mediaId: { shop: r.shop, mediaId: r.mediaId } },
      update: record,
      create: { shop: r.shop, mediaId: r.mediaId, ...record, createdAt: toDate(r.createdAt) ?? new Date() },
    });
  }, { dryRun });

  db.close();
  console.log("\ndone.");
}

const BOOLEAN_SETTINGS = new Set([
  "showPinnedReels", "showArrows", "playVideoOnHover", "showThumbnail",
  "showViewsCount", "showAuthorProfile", "showAttachedProducts", "cleanDisplay",
]);
function isBooleanColumn(name) {
  return BOOLEAN_SETTINGS.has(name);
}

main()
  .catch((error) => {
    console.error("\nmigration failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
