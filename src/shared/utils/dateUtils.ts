export type DateFilterType = 'All' | 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'This Year' | 'Last Month' | 'Custom';

export const parseDate = (dateStr?: string | null): Date | null => {
  if (!dateStr || !dateStr.trim()) return null;
  const clean = dateStr.trim();

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    const year = parseInt(dmy[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      return d;
    }
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymd = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10) - 1;
    const day = parseInt(ymd[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      return d;
    }
  }

  const standard = new Date(clean);
  if (isNaN(standard.getTime())) return null;
  standard.setHours(0, 0, 0, 0);
  return standard;
};

export const filterByDate = (
  dateStr?: string | null,
  filterType: DateFilterType | string = 'All',
  customStartDate?: string,
  customEndDate?: string
): boolean => {
  if (!dateStr || filterType === 'All') return true;
  const parsed = parseDate(dateStr);
  if (!parsed) return true;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filterType) {
    case 'Today':
      return parsed.getTime() === today.getTime();
    case 'Yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return parsed.getTime() === yesterday.getTime();
    }
    case 'This Week': {
      const dayOfWeek = today.getDay(); // 0 is Sun
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return parsed.getTime() >= monday.getTime() && parsed.getTime() <= sunday.getTime();
    }
    case 'This Month':
      return parsed.getFullYear() === today.getFullYear() && parsed.getMonth() === today.getMonth();
    case 'Last Month': {
      const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return parsed.getFullYear() === lastMonthDate.getFullYear() && parsed.getMonth() === lastMonthDate.getMonth();
    }
    case 'This Year':
      return parsed.getFullYear() === today.getFullYear();
    case 'Custom': {
      const start = customStartDate ? parseDate(customStartDate) : null;
      const end = customEndDate ? parseDate(customEndDate) : null;
      if (start && end) {
        return parsed.getTime() >= start.getTime() && parsed.getTime() <= end.getTime();
      }
      if (start) return parsed.getTime() >= start.getTime();
      if (end) return parsed.getTime() <= end.getTime();
      return true;
    }
    default:
      return true;
  }
};

export const isDateInPeriod = (
  dateStr?: string | null,
  period: string = 'All',
  startDate?: string,
  endDate?: string
): boolean => {
  return filterByDate(dateStr, period, startDate, endDate);
};

export const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return '-';
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};
