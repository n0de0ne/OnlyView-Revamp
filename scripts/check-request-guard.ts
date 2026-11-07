/**
 * night GN-507/508/509: `npx tsx scripts/check-request-guard.ts` — the public forms' guards (no test runner in this repo).
 */
import assert from "node:assert/strict";
import { esc, oneLine, realDay, requestIp } from "../src/lib/request-guard";

const name = `<a href="https://evil.example">Click to confirm</a>`;
assert.equal(esc(name), "&lt;a href=&quot;https://evil.example&quot;&gt;Click to confirm&lt;/a&gt;");
assert.ok(!esc(`<img src=x onerror=1><b>call</b>`).includes("<"));
assert.equal(oneLine("Alex\r\nBcc: x@y"), false);
assert.equal(realDay("2027-02-30"), false);
assert.equal(realDay("2027-13-01"), false);
assert.equal(realDay("2027-02-28"), true);
const h = (o: Record<string, string>) => new Headers(o);
assert.equal(requestIp(h({ "x-forwarded-for": "9.9.9.9, 1.2.3.4" })), "1.2.3.4");
assert.equal(requestIp(h({ "cf-connecting-ip": "5.6.7.8", "x-forwarded-for": "9.9.9.9, 1.2.3.4" })), "5.6.7.8");
assert.equal(requestIp(h({ "cf-connecting-ip": "not-an-ip", "x-forwarded-for": "1.2.3.4" })), "1.2.3.4");
assert.equal(requestIp(h({})), "local");
console.log("request-guard: ok");
