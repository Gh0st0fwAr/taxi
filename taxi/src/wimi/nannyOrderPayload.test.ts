declare const describe: (name: string, fn: () => void) => void
declare const test: (name: string, fn: () => void) => void
declare const expect: (actual: unknown) => any

import { buildNannyCreatePayload, parseNannyCreateOrderEnvelope } from './nannyOrderPayload'

const draft = {
  latitude: 40.4168,
  longitude: -3.7038,
  date: '2026-01-10',
  startTime: '10:00',
  durationMinutes: 120,
  childrenCount: 2,
}

describe('nanny_pricing create DTO', () => {
  test('maps the single service location, duration and children to the observed bot DTO', () => {
    expect(buildNannyCreatePayload(draft, 'wimi-order-123')).toEqual({
      action: 'create',
      request_key: 'wimi-order-123',
      time_zone: 'Europe/Madrid',
      order: {
        b_start_latitude: '40.4168',
        b_start_longitude: '-3.7038',
        b_start_datetime: '2026-01-10 10:00:00+01:00',
        b_passengers_count: 2,
        b_max_waiting: 3600,
        b_payment_way: 1,
        b_services: [],
        b_comments: [],
        b_options: {
          submitPrice: 0,
          createdBy: 'wimi',
          childrenProfiles: '2',
          b_end_datetime: '2026-01-10 11:00:00+00:00',
        },
      },
    })
  })

  test('uses the summer offset and calculates end as an unambiguous UTC instant', () => {
    const payload = buildNannyCreatePayload({
      ...draft,
      date: '2026-07-10',
      startTime: '10:00',
      durationMinutes: 130,
    }, 'wimi-order-123')
    expect(payload.order.b_start_datetime).toBe('2026-07-10 10:00:00+02:00')
    expect(payload.order.b_options.b_end_datetime).toBe('2026-07-10 10:10:00+00:00')
  })

  test('does not invent or require a destination point', () => {
    const payload = buildNannyCreatePayload(draft, 'wimi-order-123')
    expect(payload.order).not.toHaveProperty('b_end_latitude')
    expect(payload.order).not.toHaveProperty('b_end_longitude')
    expect(payload.order).not.toHaveProperty('to')
  })

  test('rejects invalid coordinates, duration, child count and idempotency key', () => {
    expect(() => buildNannyCreatePayload({ ...draft, latitude: 91 }, 'wimi-order-123')).toThrow('координаты')
    expect(() => buildNannyCreatePayload({ ...draft, durationMinutes: 0 }, 'wimi-order-123')).toThrow('длительность')
    expect(() => buildNannyCreatePayload({ ...draft, childrenCount: 0 }, 'wimi-order-123')).toThrow('количество детей')
    expect(() => buildNannyCreatePayload(draft, 'short')).toThrow('Ключ создания заказа')
  })

  test('parses the server order ID and duplicate response', () => {
    expect(parseNannyCreateOrderEnvelope({
      status: 'success',
      data: { b_id: 4200, duplicate: true, pricingModel: { price: '30', calculationType: 'complete' } },
    })).toEqual({
      orderId: '4200',
      duplicate: true,
      pricingModel: { price: '30', calculationType: 'complete' },
    })
  })

  test('rejects unsuccessful or malformed create responses', () => {
    expect(() => parseNannyCreateOrderEnvelope({ status: 'error', message: 'internal database error' })).toThrow('Не удалось подтвердить создание заказа')
    expect(() => parseNannyCreateOrderEnvelope({ status: 'success', data: { b_id: 'not-an-id' } })).toThrow('идентификатор')
  })
})
