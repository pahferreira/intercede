export const languages = ["pt", "en"] as const;

export type Language = (typeof languages)[number];

export const intentionTextLength = { min: 10, max: 1000 } as const;
