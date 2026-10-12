export type WimiBookingDraft = {
  address: string
  date: string
  startTime: string
  durationMinutes: number
  childrenCount: number
  childrenAges: string
  notes: string
}

export type WimiDemoOrder = WimiBookingDraft & {
  id: string
  status: 'CREATED'
  createdAt: string
  estimatedTotalCents: number
}

export const MINIMUM_DURATION_MINUTES = 120
export const BILLING_BLOCK_MINUTES = 10
export const BASE_BLOCK_PRICE_CENTS = 250
export const MINIMUM_BASE_PRICE_CENTS = 3000
const EARLIEST_START_MINUTES = 6 * 60
const LATEST_START_MINUTES = 22 * 60

export function calculateBaseQuoteCents(durationMinutes: number): number {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 0

  const fullBlocks = Math.floor(durationMinutes / BILLING_BLOCK_MINUTES)
  const blockTotal = fullBlocks * BASE_BLOCK_PRICE_CENTS
  return durationMinutes >= MINIMUM_DURATION_MINUTES
    ? Math.max(MINIMUM_BASE_PRICE_CENTS, blockTotal)
    : blockTotal
}

export function validateBookingDraft(draft: WimiBookingDraft, now = new Date()): string[] {
  const errors: string[] = []
  const safeDraft = draft && typeof draft === 'object' ? draft : ({} as WimiBookingDraft)
  const startMinutes = typeof safeDraft.startTime === 'string' ? parseTime(safeDraft.startTime) : null
  const validDate = typeof safeDraft.date === 'string' ? parseDate(safeDraft.date) : null

  if (typeof safeDraft.address !== 'string' || !safeDraft.address.trim()) {
    errors.push('Укажите адрес оказания услуги.')
  }

  if (!validDate) {
    errors.push('Укажите корректную дату.')
  } else {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (validDate.getTime() < today.getTime()) {
      errors.push('Дата заказа не может быть в прошлом.')
    }
  }

  if (startMinutes === null || startMinutes < EARLIEST_START_MINUTES || startMinutes > LATEST_START_MINUTES) {
    errors.push('Начало заказа должно быть с 06:00 до 22:00 включительно.')
  } else if (startMinutes === LATEST_START_MINUTES) {
    errors.push('Начало в 22:00 не позволяет выполнить минимальную длительность до полуночи.')
  } else if (validDate && validDate.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    && startMinutes <= now.getHours() * 60 + now.getMinutes()) {
    errors.push('Выберите время в будущем.')
  }

  if (!Number.isInteger(safeDraft.durationMinutes) || safeDraft.durationMinutes < MINIMUM_DURATION_MINUTES) {
    errors.push('Минимальная длительность заказа — 120 минут.')
  } else if (startMinutes !== null && safeDraft.durationMinutes > 1440 - startMinutes) {
    errors.push('Заказ должен завершиться не позднее 00:00.')
  }

  if (!Number.isInteger(safeDraft.childrenCount) || safeDraft.childrenCount < 1 || safeDraft.childrenCount > 8) {
    errors.push('Укажите количество детей от 1 до 8.')
  }

  if (typeof safeDraft.childrenAges !== 'string') {
    errors.push('Проверьте поле возраста детей.')
  }
  if (typeof safeDraft.notes !== 'string') {
    errors.push('Проверьте поле комментария.')
  }

  return errors
}

export function createDemoOrder(draft: WimiBookingDraft, now = new Date()): WimiDemoOrder {
  const errors = validateBookingDraft(draft, now)
  if (errors.length > 0) throw new Error(errors.join(' '))

  return {
    ...draft,
    id: `WIMI-DEMO-${now.getTime().toString(36).toUpperCase()}`,
    status: 'CREATED',
    createdAt: now.toISOString(),
    estimatedTotalCents: calculateBaseQuoteCents(draft.durationMinutes),
  }
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime()) || localDateString(date) !== value) return null
  return date
}

function parseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

function localDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
