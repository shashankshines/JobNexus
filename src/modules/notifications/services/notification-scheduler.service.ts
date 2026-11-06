import { NotificationPreferences } from '../domain/smart-notification.types';

export interface LocalTimeParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  weekday: number; // 1 = Monday, 7 = Sunday
  isoWeekday: number; // 1 = Monday, 7 = Sunday (alias)
  hour: number; // 0-23
  hours: number; // alias
  minute: number; // 0-59
  minutes: number; // alias
  second: number; // 0-59
  seconds: number; // alias
}

const WEEKDAY_MAP: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/**
 * Extracts local date and time parts for a given Date in a specific IANA timezone.
 */
export function getLocalTimeParts(date: Date, timezone: string): LocalTimeParts {
  const safeTimezone = isValidTimezone(timezone) ? timezone : 'Asia/Kolkata';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimezone,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const weekdayStr = partMap.weekday || 'Mon';
  const weekday = WEEKDAY_MAP[weekdayStr] || 1;

  const h = parseInt(partMap.hour, 10);
  const m = parseInt(partMap.minute, 10);
  const s = parseInt(partMap.second, 10);

  return {
    year: parseInt(partMap.year, 10),
    month: parseInt(partMap.month, 10),
    day: parseInt(partMap.day, 10),
    weekday,
    isoWeekday: weekday,
    hour: h,
    hours: h,
    minute: m,
    minutes: m,
    second: s,
    seconds: s,
  };
}

export function parseTimeString(timeStr: string): { hour: number; minute: number } {
  const [hStr, mStr] = timeStr.split(':');
  const hour = Math.max(0, Math.min(23, parseInt(hStr || '9', 10)));
  const minute = Math.max(0, Math.min(59, parseInt(mStr || '0', 10)));
  return { hour, minute };
}

export function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Determines whether a given timestamp falls within the user's configured notification delivery window.
 * Delivery window condition:
 *   activeDays includes localWeekday &&
 *   startTime <= localTime < endTime
 */
export function isWithinDeliveryWindow(date: Date, preferences: NotificationPreferences): boolean {
  if (!preferences.enabled) {
    return false;
  }

  const local = getLocalTimeParts(date, preferences.timezone);
  const activeDays = Array.isArray(preferences.activeDays) && preferences.activeDays.length > 0
    ? preferences.activeDays
    : [1, 2, 3, 4, 5, 6];

  if (!activeDays.includes(local.weekday)) {
    return false;
  }

  const start = parseTimeString(preferences.startTime || '09:00');
  const end = parseTimeString(preferences.endTime || '21:00');

  const currentMinutes = local.hour * 60 + local.minute;
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Converts a target local date/time (in a given IANA timezone) into a precise UTC Date object.
 */
export function createUtcDateFromLocal(
  targetYear: number,
  targetMonth: number, // 1-12
  targetDay: number,
  targetHour: number,
  targetMinute: number,
  timezone: string
): Date {
  const safeTimezone = isValidTimezone(timezone) ? timezone : 'Asia/Kolkata';

  // 1. Initial UTC guess
  let utcGuess = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, targetHour, targetMinute, 0, 0));

  // 2. Iterative adjustment to account for timezone offset and DST transitions
  for (let i = 0; i < 3; i++) {
    const localAtGuess = getLocalTimeParts(utcGuess, safeTimezone);
    const diffMinutes =
      (localAtGuess.year - targetYear) * 525600 +
      (localAtGuess.month - targetMonth) * 43200 +
      (localAtGuess.day - targetDay) * 1440 +
      (localAtGuess.hour - targetHour) * 60 +
      (localAtGuess.minute - targetMinute);

    if (diffMinutes === 0) break;
    utcGuess = new Date(utcGuess.getTime() - diffMinutes * 60 * 1000);
  }

  return utcGuess;
}

/**
 * Calculates the exact next delivery time when notifications can be delivered.
 * If currently within the delivery window, returns fromDate immediately.
 * Otherwise, calculates the upcoming start time on the next active day.
 */
export function calculateNextDeliveryWindow(fromDate: Date, preferences: NotificationPreferences): Date {
  if (isWithinDeliveryWindow(fromDate, preferences)) {
    return fromDate;
  }

  const local = getLocalTimeParts(fromDate, preferences.timezone);
  const activeDays = Array.isArray(preferences.activeDays) && preferences.activeDays.length > 0
    ? preferences.activeDays
    : [1, 2, 3, 4, 5, 6];
  const start = parseTimeString(preferences.startTime || '09:00');
  const startMinutes = start.hour * 60 + start.minute;
  const currentMinutes = local.hour * 60 + local.minute;

  // Case 1: Today is an active day, and current time is before the start time
  if (activeDays.includes(local.weekday) && currentMinutes < startMinutes) {
    return createUtcDateFromLocal(
      local.year,
      local.month,
      local.day,
      start.hour,
      start.minute,
      preferences.timezone
    );
  }

  // Case 2: Today is either not an active day or we passed the end time.
  // Search forward for the next active day starting at dayOffset = 1
  for (let dayOffset = 1; dayOffset <= 8; dayOffset++) {
    // Next calendar day in local time
    const futureLocalMidnightUtc = createUtcDateFromLocal(
      local.year,
      local.month,
      local.day + dayOffset,
      start.hour,
      start.minute,
      preferences.timezone
    );

    const futureLocal = getLocalTimeParts(futureLocalMidnightUtc, preferences.timezone);
    if (activeDays.includes(futureLocal.weekday)) {
      return futureLocalMidnightUtc;
    }
  }

  // Fallback safe 24 hours
  return new Date(fromDate.getTime() + 24 * 60 * 60 * 1000);
}
