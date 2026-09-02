import { getSettings } from "./settings";

/**
 * Optional features, switched from Réglages without a redeploy.
 *
 * The loyalty programme is fully built (schema, earning, tiers, admin board,
 * guest portal panel) but switched OFF by default: set `loyalty_enabled` to
 * "1" in the settings to bring it back everywhere at once.
 */
export async function isLoyaltyEnabled(): Promise<boolean> {
  const s = await getSettings();
  return s.loyalty_enabled === "1";
}
