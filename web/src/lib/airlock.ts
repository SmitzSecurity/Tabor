import type { AppSettings, AirlockConfig } from "./types";

const EIGHT_H_MS = 8 * 60 * 60 * 1000;

export function periodKeyFor(now: number, config: AirlockConfig): number {
  if (config.period === "8h") {
    return Math.floor(now / EIGHT_H_MS) * EIGHT_H_MS;
  }
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function normalizeAirlock(config: AirlockConfig, now: number): AirlockConfig {
  const key = periodKeyFor(now, config);
  if (config.periodKey === key) return config;
  return { ...config, periodKey: key, reviewsThisPeriod: 0 };
}

export function isAirlockSatisfied(
  now: number,
  config: AirlockConfig
): { satisfied: boolean; need: number; have: number } {
  const c = normalizeAirlock(config, now);
  return {
    satisfied: !c.enabled || c.reviewsThisPeriod >= c.requiredReviews,
    need: c.requiredReviews,
    have: c.reviewsThisPeriod,
  };
}

export function nextAirlockAfterReview(
  now: number,
  config: AirlockConfig
): AirlockConfig {
  const c = normalizeAirlock(config, now);
  const nextCount = c.reviewsThisPeriod + 1;
  const satisfied = nextCount >= c.requiredReviews;
  return {
    ...c,
    reviewsThisPeriod: nextCount,
    lastSatisfiedAt: satisfied ? now : c.lastSatisfiedAt,
  };
}

export function airlockSatisfiedState(settings: AppSettings, now: number) {
  return isAirlockSatisfied(now, settings.airlock);
}
