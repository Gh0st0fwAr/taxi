function madridOffsetForLocalDateTime(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0)

  const offsetAt = (instant: number): number => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(instant))
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
    const localAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    )
    return (localAsUtc - instant) / 60000
  }

  let offset = offsetAt(wallClockAsUtc)
  let instant = wallClockAsUtc - offset * 60000
  offset = offsetAt(instant)
  instant = wallClockAsUtc - offset * 60000
  const sign = offset >= 0 ? '+' : '-'
  const absolute = Math.abs(offset)
  const hh = String(Math.floor(absolute / 60)).padStart(2, '0')
  const mm = String(absolute % 60).padStart(2, '0')
  return `${date} ${time}:00${sign}${hh}:${mm}`
}

export function buildNannyQuotePayload(date: string, startTime: string, durationMinutes: number) {
  return {
    action: 'quote',
    when: madridOffsetForLocalDateTime(date, startTime),
    time_zone: 'Europe/Madrid',
    duration_min: durationMinutes,
    options: [] as number[],
  }
}
