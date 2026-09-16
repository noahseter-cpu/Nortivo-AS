import { z } from "zod";
export const profileSchema = z.object({
  heightCm: z.number().finite().min(80).max(250),
  weightKg: z.number().finite().min(20).max(400),
  age: z.number().int().min(1).max(120),
  equation: z.enum(["female", "male", "none"]),
  activity: z.enum(["low", "light", "moderate", "high"]),
  suitability: z.enum(["general", "pregnant", "medical", "none"]),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type Profile = z.infer<typeof profileSchema>;
export const activityLevels = {
  low: {
    factor: 1.4,
    label: "Lite aktiv",
    detail: "Mest stillesitting, lite daglig bevegelse",
  },
  light: {
    factor: 1.6,
    label: "Lett aktiv",
    detail: "Lett aktivitet og regelmessige gåturer",
  },
  moderate: {
    factor: 1.8,
    label: "Aktiv",
    detail: "Mye daglig bevegelse og regelmessig trening",
  },
  high: {
    factor: 2,
    label: "Svært aktiv",
    detail: "Fysisk arbeid eller mye trening de fleste dager",
  },
};
/** Maintenance only. Mifflin–St Jeor REE times a user-selected approximate PAL.
 * This is not NIDDK's dynamic Body Weight Planner model. */
export function calorieSuggestion(raw: Profile) {
  const p = profileSchema.parse(raw);
  if (p.age < 18 || p.age > 78)
    return {
      eligible: false as const,
      reason:
        "Dette voksenestimatet brukes bare for alderen 18–78 år. Bruk et individuelt mål avtalt med helsepersonell.",
    };
  if (p.equation === "none" || p.suitability !== "general")
    return {
      eligible: false as const,
      reason:
        "Vi lager ikke et automatisk estimat uten egnet beregningsgrunnlag. Du kan fortsatt bruke trackeren og velge et mål selv.",
    };
  const resting =
    10 * p.weightKg +
    6.25 * p.heightCm -
    5 * p.age +
    (p.equation === "male" ? 5 : -161);
  const maintenance = resting * activityLevels[p.activity].factor;
  if (resting <= 0 || maintenance < 1200 || maintenance > 6000)
    return {
      eligible: false as const,
      reason:
        "Verdiene ligger utenfor området denne enkle beregningen håndterer. Kontroller opplysningene eller få et individuelt mål.",
    };
  const rounded = Math.round(maintenance / 50) * 50;
  return {
    eligible: true as const,
    calories: rounded,
    low: Math.floor((maintenance * 0.9) / 50) * 50,
    high: Math.ceil((maintenance * 1.1) / 50) * 50,
    resting: Math.round(resting),
  };
}
