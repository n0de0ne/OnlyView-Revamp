/**
 * Public forms' guards (night GN-507/508/509): escaping in the owner's emails,
 * header injection, real calendar days, the client's address behind the proxy.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { esc, oneLine, realDay, requestIp } from "../../src/lib/request-guard";

test("esc neutralises HTML typed in a form", () => {
  const name = `<a href="https://evil.example">Click to confirm</a>`;
  assert.equal(esc(name), "&lt;a href=&quot;https://evil.example&quot;&gt;Click to confirm&lt;/a&gt;");
  assert.ok(!esc(`<img src=x onerror=1><b>call</b>`).includes("<"));
});

test("oneLine refuses header injection", () => {
  assert.equal(oneLine("Alex\r\nBcc: x@y"), false);
});

test("realDay only accepts days that exist", () => {
  assert.equal(realDay("2027-02-30"), false);
  assert.equal(realDay("2027-13-01"), false);
  assert.equal(realDay("2027-02-28"), true);
});

test("requestIp trusts the proxy's last hop, then Cloudflare", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  assert.equal(requestIp(h({ "x-forwarded-for": "9.9.9.9, 1.2.3.4" })), "1.2.3.4");
  assert.equal(requestIp(h({ "cf-connecting-ip": "5.6.7.8", "x-forwarded-for": "9.9.9.9, 1.2.3.4" })), "5.6.7.8");
  assert.equal(requestIp(h({ "cf-connecting-ip": "not-an-ip", "x-forwarded-for": "1.2.3.4" })), "1.2.3.4");
  assert.equal(requestIp(h({})), "local");
});
