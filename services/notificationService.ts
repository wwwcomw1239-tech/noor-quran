// --- Notification Service ---
// Uses the Notification API + setTimeout scheduling for local reminders.
// Works in PWAs and modern browsers.

const NOTIFICATION_ICON = '/icon.png';

export type NotificationSettings = {
  enabled: boolean;
  dailyReminder: boolean;
  dailyReminderTime: string; // HH:mm format e.g. "08:00"
  prayerAlerts: boolean;
  prayerAlertMinutesBefore: number; // minutes before prayer time
  streakReminder: boolean;
  ramadanGoalReminder: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  dailyReminder: true,
  dailyReminderTime: '08:00',
  prayerAlerts: false,
  prayerAlertMinutesBefore: 10,
  streakReminder: true,
  ramadanGoalReminder: true,
};

// --- Permission ---

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

export function getPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// --- Send Notification ---

function sendNotification(title: string, body: string, tag?: string) {
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: tag || 'noor-general',
      silent: false,
    });
  } catch {
    // Fallback for some mobile browsers that require ServiceWorker notifications
    navigator.serviceWorker?.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon: NOTIFICATION_ICON,
        badge: NOTIFICATION_ICON,
        tag: tag || 'noor-general',
      });
    });
  }
}

// --- Scheduler ---
// Keeps track of active timers so we can clear them on settings change.

const activeTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

function clearTimer(key: string) {
  const t = activeTimers.get(key);
  if (t) {
    clearTimeout(t);
    activeTimers.delete(key);
  }
}

export function clearAllTimers() {
  activeTimers.forEach((t) => clearTimeout(t));
  activeTimers.clear();
}

function scheduleAt(key: string, targetTime: Date, callback: () => void) {
  clearTimer(key);
  const now = Date.now();
  const delay = targetTime.getTime() - now;
  if (delay <= 0) return; // time already passed today
  const timer = setTimeout(() => {
    callback();
    activeTimers.delete(key);
  }, delay);
  activeTimers.set(key, timer);
}

// --- Schedule: Daily Reading Reminder ---

export function scheduleDailyReminder(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  // If time already passed today, schedule for tomorrow
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  scheduleAt('daily-reminder', target, () => {
    sendNotification(
      '📖 Time to Read Quran',
      'Your daily reading awaits. Keep your spiritual journey going!',
      'noor-daily'
    );
    // Reschedule for tomorrow
    scheduleDailyReminder(timeStr);
  });
}

// --- Schedule: Streak Reminder ---
// Fires in the evening (8 PM) if user hasn't read today

export function scheduleStreakReminder(hasReadToday: boolean, streak: number) {
  if (hasReadToday) {
    clearTimer('streak-reminder');
    return;
  }
  const now = new Date();
  const target = new Date();
  target.setHours(20, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    // Already past 8 PM — fire in 1 minute if they haven't read
    target.setTime(now.getTime() + 60_000);
  }
  scheduleAt('streak-reminder', target, () => {
    sendNotification(
      '🔥 Protect Your Streak!',
      streak > 0
        ? `You have a ${streak}-day streak. Read today to keep it alive!`
        : 'Start a reading streak today. Open the Quran and begin!',
      'noor-streak'
    );
  });
}

// --- Schedule: Prayer Time Alerts ---

const PRAYER_NAMES: Record<string, string> = {
  Fajr: '🌅 Fajr',
  Dhuhr: '☀️ Dhuhr',
  Asr: '🌤️ Asr',
  Maghrib: '🌇 Maghrib',
  Isha: '🌙 Isha',
};

export function schedulePrayerAlerts(
  prayerTimes: Record<string, string>,
  minutesBefore: number
) {
  // Clear existing prayer timers
  Object.keys(PRAYER_NAMES).forEach(p => clearTimer(`prayer-${p}`));

  const now = new Date();

  Object.entries(PRAYER_NAMES).forEach(([key, label]) => {
    const timeStr = prayerTimes[key]; // e.g. "05:23"
    if (!timeStr) return;

    const [h, m] = timeStr.split(':').map(Number);
    const prayerTime = new Date();
    prayerTime.setHours(h, m, 0, 0);

    // Alert X minutes before
    const alertTime = new Date(prayerTime.getTime() - minutesBefore * 60_000);

    if (alertTime.getTime() > now.getTime()) {
      scheduleAt(`prayer-${key}`, alertTime, () => {
        sendNotification(
          `${label} in ${minutesBefore} min`,
          minutesBefore > 0
            ? `${label} prayer is coming up. Prepare for salah.`
            : `It's time for ${label} prayer.`,
          `noor-prayer-${key}`
        );
      });
    }
  });
}

// --- Schedule: Ramadan Goal Reminder ---
// Fires at 9 PM if user hasn't completed their daily page target

export function scheduleRamadanGoalReminder(
  pagesReadToday: number,
  dailyTarget: number
) {
  if (pagesReadToday >= dailyTarget) {
    clearTimer('ramadan-goal');
    return;
  }
  const now = new Date();
  const target = new Date();
  target.setHours(21, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setTime(now.getTime() + 60_000);
  }
  const remaining = dailyTarget - pagesReadToday;
  scheduleAt('ramadan-goal', target, () => {
    sendNotification(
      '🌙 Ramadan Goal Reminder',
      `You have ${remaining} page${remaining !== 1 ? 's' : ''} left for today. Keep going!`,
      'noor-ramadan-goal'
    );
  });
}

// --- Load & Save Settings ---

const STORAGE_KEY = 'noor_notification_settings';

export function loadNotificationSettings(): NotificationSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...DEFAULT_NOTIFICATION_SETTINGS };
}

export function saveNotificationSettings(settings: NotificationSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}
