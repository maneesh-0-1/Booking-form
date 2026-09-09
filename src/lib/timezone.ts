import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { format, parseISO, addMinutes } from "date-fns";

export const CLINIC_TIMEZONE = process.env.CLINIC_TIMEZONE || "America/Edmonton";

// Clinic hours (09:00 to 18:00 Mountain Time)
export const CLINIC_START_HOUR = 9;
export const CLINIC_END_HOUR = 18;
export const SLOT_STEP_MINUTES = 30; // 30-minute discretization grid

export interface BlockInterval {
  start: Date;
  end: Date;
}

export interface AvailableSlot {
  time: string;       // "09:00"
  displayTime: string;// "9:00 AM"
  isoString: string;  // Full ISO string in Mountain Time representation
  endIsoString: string;
}

/**
 * Returns today's date formatted as YYYY-MM-DD in the local user/client environment
 */
export function getLocalTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns the current date in Mountain Time formatted as YYYY-MM-DD
 */
export function getCurrentDateInClinicTz(): string {
  const now = new Date();
  return formatInTimeZone(now, CLINIC_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Parses an ISO string or wall-clock string into an exact Date object in Mountain Time
 */
export function parseClinicDateTime(dateStr: string): Date {
  // If string contains explicit timezone offset at end (e.g. "Z" or "-06:00" or "+00:00")
  if (dateStr.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }
  // Otherwise treat as Mountain Time wall-clock string
  return fromZonedTime(dateStr, CLINIC_TIMEZONE);
}

/**
 * Returns YYYY-MM-DD for any Date in Mountain Time
 */
export function formatToClinicDateStr(date: Date): string {
  return formatInTimeZone(date, CLINIC_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Parses YYYY-MM-DD and HH:mm into a Date object representing that exact Mountain Time moment
 */
export function createClinicDateTime(dateStr: string, timeStr: string): Date {
  const dateString = `${dateStr}T${timeStr.padStart(5, "0")}:00`;
  return fromZonedTime(dateString, CLINIC_TIMEZONE);
}

/**
 * Formats a Date object to Mountain Time string (HH:mm)
 */
export function formatToClinicTime(date: Date): string {
  return formatInTimeZone(date, CLINIC_TIMEZONE, "HH:mm");
}

/**
 * Formats a Date object to Mountain Time display (e.g. 9:00 AM)
 */
export function formatToClinicDisplayTime(date: Date): string {
  return formatInTimeZone(date, CLINIC_TIMEZONE, "h:mm a");
}

/**
 * Formats a Date object to Mountain Time full date display (e.g. Wednesday, Sep 10, 2026)
 */
export function formatToClinicDisplayDate(date: Date): string {
  return formatInTimeZone(date, CLINIC_TIMEZONE, "EEEE, MMM d, yyyy");
}

/**
 * Formats a Date object into SQL DATETIME format (YYYY-MM-DD HH:MM:SS) in Clinic Timezone
 */
export function formatToSqlDateTime(date: Date): string {
  return formatInTimeZone(date, CLINIC_TIMEZONE, "yyyy-MM-dd HH:mm:ss");
}

/**
 * Calculates all valid, non-overlapping available slots for a given date and duration
 */
export function computeAvailableSlots(
  requestedDate: string, // "YYYY-MM-DD"
  durationMinutes: number,
  blockedIntervals: BlockInterval[],
  operatingHours?: { startTime?: string; endTime?: string }
): AvailableSlot[] {
  const availableSlots: AvailableSlot[] = [];

  const startHourStr = operatingHours?.startTime || "09:00";
  const endHourStr = operatingHours?.endTime || "18:00";

  // Create start and end bounds for the given date in Mountain Time
  const dayStart = createClinicDateTime(requestedDate, startHourStr);
  const dayEnd = createClinicDateTime(requestedDate, endHourStr);

  const now = new Date();

  // Iterate cursor from 09:00 in increments of SLOT_STEP_MINUTES
  let cursor = new Date(dayStart.getTime());

  while (true) {
    const slotEnd = addMinutes(cursor, durationMinutes);

    // Stop if the slot exceeds clinic closing time (18:00)
    if (slotEnd.getTime() > dayEnd.getTime()) {
      break;
    }

    // Defensive: filter out past slots if requested date is today
    const isPast = cursor.getTime() <= now.getTime();

    if (!isPast) {
      // Collision Detection: Overlaps = (block.start < slotEnd) && (block.end > slotStart)
      const hasOverlap = blockedIntervals.some((block) => {
        const bStart = block.start.getTime();
        const bEnd = block.end.getTime();
        const sStart = cursor.getTime();
        const sEnd = slotEnd.getTime();
        return bStart < sEnd && bEnd > sStart;
      });

      if (!hasOverlap) {
        const timeStr = formatToClinicTime(cursor);
        const displayTimeStr = formatToClinicDisplayTime(cursor);
        const isoString = cursor.toISOString();
        const endIsoString = slotEnd.toISOString();

        availableSlots.push({
          time: timeStr,
          displayTime: displayTimeStr,
          isoString,
          endIsoString,
        });
      }
    }

    cursor = addMinutes(cursor, SLOT_STEP_MINUTES);
  }

  return availableSlots;
}
