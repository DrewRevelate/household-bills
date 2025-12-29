export type TimeFrame = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all_time';

export const TIME_FRAME_OPTIONS: { value: TimeFrame; label: string }[] = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all_time', label: 'All Time' },
];

export function getTimeFrameDateRange(timeFrame: TimeFrame): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (timeFrame) {
    case 'this_month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'last_month':
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'this_quarter':
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      start.setMonth(quarterStartMonth);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(quarterStartMonth + 3);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'this_year':
      start.setMonth(0);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11);
      end.setDate(31);
      end.setHours(23, 59, 59, 999);
      break;
    case 'all_time':
      start.setFullYear(2000);
      end.setFullYear(2100);
      break;
  }

  return { start, end };
}

export function getTimeFrameLabel(timeFrame: TimeFrame): string {
  return TIME_FRAME_OPTIONS.find(o => o.value === timeFrame)?.label || 'Period';
}

export function filterBillsByTimeFrame<T extends { dueDate: string }>(
  bills: T[],
  timeFrame: TimeFrame
): T[] {
  const { start, end } = getTimeFrameDateRange(timeFrame);
  return bills.filter((b) => {
    // Parse as local date to avoid timezone issues
    const [year, month, day] = b.dueDate.split('-').map(Number);
    const dueDate = new Date(year, month - 1, day);
    return dueDate >= start && dueDate <= end;
  });
}
