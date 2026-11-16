import { z } from "zod";
import type { Database } from "./db";
import {
  defaultLocationSettings,
  type LocationSettings,
} from "../features/orbit/location-settings";
export const locationSchema = z
  .object({
    country_enabled: z.boolean(),
    outside_country_enabled: z.boolean(),
    city_enabled: z.boolean(),
  })
  .strict()
  .refine((s) => s.country_enabled || !s.outside_country_enabled, {
    message: "Enable country before cross-country matching.",
  });
export async function locationSettings(
  db: Database,
  roundId: string,
): Promise<LocationSettings> {
  const row = await db.one("SELECT data FROM round_settings WHERE round_id=?", [
    roundId,
  ]);
  return row
    ? locationSchema.parse(JSON.parse(row.data))
    : { ...defaultLocationSettings };
}
export function locationComplete(
  p: Record<string, unknown>,
  s: LocationSettings,
) {
  return (
    (!s.country_enabled ||
      (typeof p.country === "string" && p.country.trim().length > 0)) &&
    (!s.city_enabled ||
      (typeof p.city === "string" && p.city.trim().length > 0))
  );
}
