import axios from 'axios'
import Config from '../config'
import { addToFormData, apiMethod, IApiMethodArguments } from '../tools/api'

export type NannyPricingQuote = {
  formula: string
  price: string | number
  options: Record<string, number>
  calculationType: string
}

type NannyPricingEnvelope = {
  status?: string
  message?: string | null
  data?: NannyPricingQuote | null
}

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

export function buildNannyQuotePayload(date: string, startTime: string) {
  return {
    action: 'quote',
    when: madridOffsetForLocalDateTime(date, startTime),
    time_zone: 'Europe/Madrid',
    options: [] as number[],
  }
}

const _getNannyPricingQuote = (
  { formData }: IApiMethodArguments,
  date: string,
  startTime: string,
): Promise<NannyPricingQuote> => {
  addToFormData(formData, {
    is_var: 1,
    s_t_data: JSON.stringify(buildNannyQuotePayload(date, startTime)),
  })

  return axios.post(`${Config.API_URL}/script/template/nanny_pricing`, formData)
    .then(res => res.data as NannyPricingEnvelope)
    .then((res) => {
      if (res.status !== 'success' || !res.data || !Number.isFinite(Number(res.data.price))) {
        throw new Error(res.message || 'Сервер не вернул предварительную цену.')
      }
      return res.data
    })
}

export const getNannyPricingQuote = apiMethod<typeof _getNannyPricingQuote>(_getNannyPricingQuote)
