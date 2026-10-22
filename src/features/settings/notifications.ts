// Shared contract for future message listeners. Keep transactional form errors visible.
export function inAppNotification(
  settings: {
    notifications_enabled: boolean;
    notification_sound_enabled: boolean;
    notification_previews_enabled: boolean;
  },
  preview: string,
  generic: string,
) {
  if (!settings.notifications_enabled) return null;
  return {
    text: settings.notification_previews_enabled ? preview : generic,
    sound: settings.notification_sound_enabled,
  };
}
export async function playNotificationSound() {
  const audio = new AudioContext();
  try {
    await audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.06, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.2);
    oscillator.onended = () => void audio.close();
  } catch {
    await audio.close();
  }
}
