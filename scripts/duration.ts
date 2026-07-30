/**
 * Normalizes the workbook's two different duration representations into a
 * plain integer match-minute:
 *  - "Goal Time (min)" / "Assist Time (min)" columns are already plain
 *    numbers (e.g. 44, 47, 18).
 *  - "Minute" (Defensive Events / Corner-Kick Analysis) and "Time In/Out"
 *    (Master (Overall)) columns are stored as Excel time-of-day values,
 *    which exceljs surfaces as a JS Date whose hour/minute/second components
 *    (in UTC, to avoid host-timezone drift) encode the elapsed match clock.
 */
export function normalizeExcelDuration(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (value instanceof Date) {
    const totalMinutes = value.getUTCHours() * 60 + value.getUTCMinutes() + value.getUTCSeconds() / 60;
    return Math.round(totalMinutes);
  }

  if (typeof value === 'number') {
    // A fractional Excel serial (0 < value < 1) is a time-of-day expressed as
    // a fraction of a 24h day; anything else is already a plain minute count.
    if (value > 0 && value < 1) {
      return Math.round(value * 24 * 60);
    }
    return Math.round(value);
  }

  if (typeof value === 'string') {
    const parts = value.split(':').map(Number);
    if (parts.length >= 2 && parts.every((p) => !Number.isNaN(p))) {
      if (parts.length === 3) {
        return Math.round(parts[0] * 60 + parts[1] + parts[2] / 60);
      }
      return Math.round(parts[0] + parts[1] / 60);
    }
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber)) {
      return Math.round(asNumber);
    }
  }

  return undefined;
}
