import { invoke, isTauri } from '@tauri-apps/api/core';

export function spokenDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (minutes === 0) return `${rem} seconds`;
  const minuteWord = minutes === 1 ? 'minute' : 'minutes';
  return `${minutes} ${minuteWord} ${rem} seconds`;
}

export function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export async function hapticTick() {
  try {
    if (await isTauri()) await invoke('play_run_haptic');
  } catch {
    // Web and non-iOS builds have no native haptic.
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(40);
  }
}
