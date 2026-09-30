import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createInstagramState,
  verifyAndExtractInstagramState,
  verifyInstagramState,
} from "./instagram-oauth.server";

const SECRET = "meta-app-secret";
const SHOP = "demo.myshopify.com";

afterEach(() => {
  vi.useRealTimers();
});

describe("OAuth state round trip", () => {
  it("accepts a state it just issued and returns the shop", () => {
    const state = createInstagramState(SHOP, SECRET);
    expect(verifyAndExtractInstagramState(state, SECRET)).toMatchObject({ shop: SHOP });
  });

  it("issues a different state each time for the same shop", () => {
    // The nonce is what stops a captured callback URL from being replayed.
    const a = createInstagramState(SHOP, SECRET);
    const b = createInstagramState(SHOP, SECRET);
    expect(a).not.toBe(b);
  });

  it("only matches the shop the state was issued for", () => {
    const state = createInstagramState(SHOP, SECRET);
    expect(verifyInstagramState(state, SHOP, SECRET)).toBeTruthy();
    expect(verifyInstagramState(state, "attacker.myshopify.com", SECRET)).toBe(false);
  });
});

describe("OAuth state rejection", () => {
  it("rejects a state signed with a different secret", () => {
    const state = createInstagramState(SHOP, "some-other-secret");
    expect(verifyAndExtractInstagramState(state, SECRET)).toBe(false);
  });

  it("rejects a payload edited to name another shop", () => {
    const [, signature] = createInstagramState(SHOP, SECRET).split(".");
    const forged = Buffer.from(
      JSON.stringify({ shop: "attacker.myshopify.com", ts: Date.now(), nonce: "x" }),
    ).toString("base64url");

    expect(verifyAndExtractInstagramState(`${forged}.${signature}`, SECRET)).toBe(false);
  });

  it("rejects a state older than the ten minute window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));
    const state = createInstagramState(SHOP, SECRET);

    vi.setSystemTime(new Date("2026-03-15T12:09:30Z"));
    expect(verifyAndExtractInstagramState(state, SECRET)).toMatchObject({ shop: SHOP });

    vi.setSystemTime(new Date("2026-03-15T12:10:30Z"));
    expect(verifyAndExtractInstagramState(state, SECRET)).toBe(false);
  });

  it.each([
    ["empty", ""],
    ["null", null],
    ["no separator", "justonesegment"],
    ["empty signature", "cGF5bG9hZA=="],
    ["signature only", ".abc123"],
    ["non-base64 payload", "!!!.abc123"],
  ])("rejects a malformed state (%s)", (_label, state) => {
    expect(verifyAndExtractInstagramState(state, SECRET)).toBe(false);
  });

  it("rejects any state when no secret is configured", () => {
    const state = createInstagramState(SHOP, SECRET);
    expect(verifyAndExtractInstagramState(state, undefined)).toBe(false);
  });

  it("does not throw on a signature of a different length", () => {
    // crypto.timingSafeEqual throws on length mismatch, so the length guard has
    // to run first.
    const [payload] = createInstagramState(SHOP, SECRET).split(".");
    expect(() => verifyAndExtractInstagramState(`${payload}.deadbeef`, SECRET)).not.toThrow();
    expect(verifyAndExtractInstagramState(`${payload}.deadbeef`, SECRET)).toBe(false);
  });
});
