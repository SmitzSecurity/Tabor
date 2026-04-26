import type { AppSettings } from "./types";

export function defaultAppSettings(): AppSettings {
  return {
    airlock: {
      enabled: true,
      requiredReviews: 5,
      period: "daily",
      lastSatisfiedAt: null,
      reviewsThisPeriod: 0,
      periodKey: 0,
    },
    focus: {
      focusTimerMinutes: 25,
      requiredPages: 10,
      autoStartOnUnlock: false,
      startHour: 6,
    },
    targetLanguage: "en",
    sourceHintLanguage: "auto",
    ollamaModel: "llama3.1",
    ollamaBaseUrl: "http://127.0.0.1:11434",
    useOllama: false,
  };
}
