/**
 * Server start hook — seeds the site's copy into the database, loads the
 * analytics geolocation database and schedules
 * the hourly reminder run (Réglages → Rappels automatiques). The run goes through /api/cron/reminders on this same
 * server, authorised by a token that only lives in this process; set
 * REMINDERS_SCHEDULER=off when an external cron calls that route instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // visitor geolocation database (Analytique): fetched/loaded in the background.
  // The inline NEXT_RUNTIME check (not just the early return above) is what
  // lets the edge compile drop this Node-only import.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    import("./lib/analytics/geo").then((m) => m.warmGeo()).catch(() => {});
  }

  // the site's copy and guide articles: write the shipped text of any block or
  // article the database doesn't have yet (edits made in the admin are kept)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Promise.all([import("./lib/site-content"), import("./lib/guides")])
      .then(async ([content, guides]) => {
        const [texts, articles] = [await content.seedSiteTexts(), await guides.seedGuides()];
        if (texts || articles) console.log(`[content] seeded ${texts} text block(s), ${articles} guide article(s)`);
        await content.getVilla(); // warm the facts the metadata helpers read
      })
      .catch((e) => console.error("[content] seeding failed:", e instanceof Error ? e.message : e));
  }

  if (process.env.REMINDERS_SCHEDULER === "off") return;

  // Web Crypto: this file is also compiled for the edge runtime, where node:crypto doesn't exist
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
  process.env.REMINDERS_INTERNAL_TOKEN = token;

  const port = process.env.PORT ?? "3000";
  const tick = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/cron/reminders`, {
        method: "POST",
        headers: { "x-cron-token": token },
      });
      const data = (await res.json().catch(() => null)) as { sent?: number } | null;
      if (data?.sent) console.log(`[reminders] ${data.sent} reminder(s) handled`);
    } catch (e) {
      console.error("[reminders] scheduled run failed:", e instanceof Error ? e.message : e);
    }
  };

  // first run once the server is listening, then every hour
  setTimeout(tick, 90_000).unref?.();
  setInterval(tick, 60 * 60_000).unref?.();
}
