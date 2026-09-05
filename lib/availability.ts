export interface NextSlotInfo {
  date: Date;
  dateKey: string;
  time: string;
  daysUntil: number;
  isToday: boolean;
  isTomorrow: boolean;
  totalFreeSlotsForDay: number;
}

export interface DayStats {
  dateKey: string;
  totalSlots: number;
  occupiedSlots: number;
  freeSlots: number;
  isFullyBooked: boolean;
  isClosed: boolean;
  freeTimes: string[];
}

export const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseTimeStringToMinutes = (timeStr: string): number => {
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
};

export function getDayAvailabilityStats(
  date: Date,
  occupiedByDate: Record<string, string[]>,
  schedule: { weekdays: string[]; saturday: string[] },
): DayStats {
  const dayOfWeek = date.getDay();
  const key = formatDateKey(date);

  // Sunday is closed
  if (dayOfWeek === 0) {
    return {
      dateKey: key,
      totalSlots: 0,
      occupiedSlots: 0,
      freeSlots: 0,
      isFullyBooked: false,
      isClosed: true,
      freeTimes: [],
    };
  }

  const allTimes = dayOfWeek === 6 ? schedule.saturday : schedule.weekdays;
  const occupied = occupiedByDate[key] || [];
  const freeTimes = allTimes.filter((t) => !occupied.includes(t));

  return {
    dateKey: key,
    totalSlots: allTimes.length,
    occupiedSlots: occupied.length,
    freeSlots: freeTimes.length,
    isFullyBooked: allTimes.length > 0 && occupied.length >= allTimes.length,
    isClosed: false,
    freeTimes,
  };
}

export function getNextAvailableSlot(
  occupiedByDate: Record<string, string[]>,
  schedule: { weekdays: string[]; saturday: string[] },
  now: Date = new Date(),
  maxDaysAhead: number = 30,
): NextSlotInfo | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset < maxDaysAhead; offset++) {
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dayOfWeek = targetDate.getDay();

    // Skip closed Sundays
    if (dayOfWeek === 0) continue;

    const allTimes = dayOfWeek === 6 ? schedule.saturday : schedule.weekdays;
    const key = formatDateKey(targetDate);
    const occupied = occupiedByDate[key] || [];

    const freeTimes = allTimes.filter((t) => {
      if (occupied.includes(t)) return false;
      // If today, filter out past slots (with 15 min buffer)
      if (offset === 0) {
        return parseTimeStringToMinutes(t) > nowMinutes + 15;
      }
      return true;
    });

    if (freeTimes.length > 0) {
      return {
        date: targetDate,
        dateKey: key,
        time: freeTimes[0],
        daysUntil: offset,
        isToday: offset === 0,
        isTomorrow: offset === 1,
        totalFreeSlotsForDay: freeTimes.length,
      };
    }
  }

  return null;
}
