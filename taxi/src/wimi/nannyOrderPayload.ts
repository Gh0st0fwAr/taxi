import { buildNannyQuotePayload } from './nannyPricingPayload'

export type WimiCreateOrderDraft = {
  latitude: number
  longitude: number
  date: string
  startTime: string
  durationMinutes: number
  childrenCount: number
}

/**
 * Contract observed in MultiBot/APIManager.createDrive and
 * server/script_templates/nanny_pricing.php. No destination is collected:
 * the service location is the single point selected by the user.
 */
export function buildNannyCreatePayload(draft: WimiCreateOrderDraft, requestKey: string) {
  if (!Number.isFinite(draft.latitude) || draft.latitude < -90 || draft.latitude > 90 ||
      !Number.isFinite(draft.longitude) || draft.longitude < -180 || draft.longitude > 180) {
    throw new Error('Для создания заказа нужны корректные координаты адреса.')
  }
  if (!Number.isInteger(draft.durationMinutes) || draft.durationMinutes < 1) {
    throw new Error('Некорректная длительность заказа.')
  }
  if (!Number.isInteger(draft.childrenCount) || draft.childrenCount < 1 || draft.childrenCount > 8) {
    throw new Error('Некорректное количество детей.')
  }
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(requestKey)) {
    throw new Error('Ключ создания заказа должен содержать от 8 до 64 допустимых символов.')
  }

  const quotePayload = buildNannyQuotePayload(draft.date, draft.startTime, draft.durationMinutes)
  const startInstant = new Date(quotePayload.when.replace(' ', 'T'))
  if (Number.isNaN(startInstant.getTime())) {
    throw new Error('Некорректные дата и время начала заказа.')
  }

  const endInstant = new Date(startInstant.getTime() + draft.durationMinutes * 60_000)
  const pad = (value: number) => String(value).padStart(2, '0')
  const formatUtc = (value: Date) =>
    `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ` +
    `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}+00:00`

  return {
    action: 'create',
    request_key: requestKey,
    time_zone: 'Europe/Madrid',
    order: {
      b_start_latitude: String(draft.latitude),
      b_start_longitude: String(draft.longitude),
      b_start_datetime: quotePayload.when,
      b_passengers_count: draft.childrenCount,
      b_max_waiting: 3600,
      b_payment_way: 1,
      b_services: [] as number[],
      b_comments: [] as number[],
      b_options: {
        submitPrice: 0,
        createdBy: 'wimi',
        childrenProfiles: String(draft.childrenCount),
        b_end_datetime: formatUtc(endInstant),
      },
    },
  }
}

export type NannyCreateOrderResult = {
  orderId: string
  duplicate: boolean
  pricingModel: {
    formula?: string
    price?: string | number
    options?: Record<string, number>
    calculationType?: string
  }
}

export type NannyCreateOrderEnvelope = {
  status?: string
  message?: string | null
  data?: {
    b_id?: number | string
    duplicate?: boolean
    pricingModel?: NannyCreateOrderResult['pricingModel']
  } | null
}

export function parseNannyCreateOrderEnvelope(response: NannyCreateOrderEnvelope): NannyCreateOrderResult {
  const id = response.data?.b_id
  if (response.status !== 'success' || id === undefined || id === null || String(id).trim() === '') {
    throw new Error('Не удалось подтвердить создание заказа. Повторите попытку с той же заявкой; не создавайте новую.')
  }
  const numericId = Number(id)
  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    throw new Error('Сервер вернул некорректный идентификатор заказа.')
  }
  return {
    orderId: String(numericId),
    duplicate: response.data?.duplicate === true,
    pricingModel: response.data?.pricingModel ?? {},
  }
}
