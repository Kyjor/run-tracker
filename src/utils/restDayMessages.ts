const REST_DAY_MESSAGES = [
  "Rest is where the gains happen. Your body is rebuilding right now.",
  "Recovery isn't optional — it's training.",
  "Today your muscles are literally getting stronger. Enjoy it.",
  "Legendary runners respect their rest days. Be legendary.",
  "Sleep is the best legal performance-enhancing drug. Take advantage.",
  "Active recovery is on the menu: stretch, foam roll, hydrate.",
  "Every great race starts with a great rest day. This is that day.",
  "You can't pour from an empty cup. Fill up today.",
];

const CROSS_TRAINING_MESSAGES = [
  "Cross-training builds the supporting cast your running legs need.",
  "Swim, bike, yoga — anything that keeps you moving without the miles.",
  "A strong athlete is more than just a runner. Build it today.",
  "Low-impact, high-reward. This is how you get to the start line healthy.",
];

/** Returns a pseudo-random rest day message stable for a given date string */
export function getRestDayMessage(dateIso: string): string {
  const seed = dateIso.replace(/-/g, '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return REST_DAY_MESSAGES[seed % REST_DAY_MESSAGES.length];
}

export function getCrossTrainingMessage(dateIso: string): string {
  const seed = dateIso.replace(/-/g, '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return CROSS_TRAINING_MESSAGES[seed % CROSS_TRAINING_MESSAGES.length];
}

