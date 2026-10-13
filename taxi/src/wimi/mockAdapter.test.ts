// The production TypeScript build also type-checks files under src. Keep the
// Jest globals locally typed because this repo does not install @types/jest.
declare const describe: (name: string, fn: () => void) => void
declare const test: (name: string, fn: () => void) => void
declare const expect: (actual: unknown) => any

import {
  createDemoOrder,
  validateBookingDraft,
  WimiBookingDraft,
} from './mockAdapter'

const draft: WimiBookingDraft = {
  address: 'Calle Mayor 1, Málaga',
  date: '2030-05-10',
  startTime: '10:00',
  durationMinutes: 120,
  childrenCount: 1,
  childrenAges: '4',
  notes: '',
}
const fixedNow = new Date(2030, 4, 1, 9, 0, 0)

describe('WIMI demo booking rules', () => {
  test('rejects blank address and malformed or impossible dates', () => {
    expect(validateBookingDraft({ ...draft, address: '   ' }, fixedNow)).toContain('Укажите адрес оказания услуги.')
    for (const date of ['', '2030-2-01', '2030-02-30', 'not-a-date']) {
      expect(validateBookingDraft({ ...draft, date }, fixedNow)).toContain('Укажите корректную дату.')
    }
  })

  test('rejects past dates and permits a future date', () => {
    expect(validateBookingDraft({ ...draft, date: '2030-04-30' }, fixedNow)).toContain('Дата заказа не может быть в прошлом.')
    expect(validateBookingDraft(draft, fixedNow)).toEqual([])
  })

  test('rejects a start time in the past or equal to now on the current date', () => {
    const now = new Date(2030, 4, 10, 10, 0, 0)
    const today = '2030-05-10'
    expect(validateBookingDraft({ ...draft, date: today, startTime: '09:59' }, now)).toContain('Выберите время в будущем.')
    expect(validateBookingDraft({ ...draft, date: today, startTime: '10:00' }, now)).toContain('Выберите время в будущем.')
    expect(validateBookingDraft({ ...draft, date: today, startTime: '10:01' }, now)).toEqual([])
  })

  test('rejects invalid times and starts outside the booking window', () => {
    for (const startTime of ['6:00', '24:00', '12:60', 'xx:yy', '05:59', '22:01']) {
      expect(validateBookingDraft({ ...draft, startTime }, fixedNow).length).toBeGreaterThan(0)
    }
    expect(validateBookingDraft({ ...draft, startTime: '22:00' }, fixedNow)).toContain(
      'Начало в 22:00 не позволяет выполнить минимальную длительность до полуночи.',
    )
    expect(validateBookingDraft({ ...draft, startTime: '06:00' }, fixedNow)).toEqual([])
  })

  test('enforces minimum duration and midnight boundary', () => {
    expect(validateBookingDraft({ ...draft, durationMinutes: 119 }, fixedNow)).toContain('Минимальная длительность заказа — 120 минут.')
    expect(validateBookingDraft({ ...draft, startTime: '21:00', durationMinutes: 180 }, fixedNow)).toEqual([])
    expect(validateBookingDraft({ ...draft, startTime: '21:00', durationMinutes: 190 }, fixedNow)).toContain('Заказ должен завершиться не позднее 00:00.')
    for (const durationMinutes of [0, -120, 120.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validateBookingDraft({ ...draft, durationMinutes }, fixedNow)).toContain('Минимальная длительность заказа — 120 минут.')
    }
  })

  test('validates children count at both boundaries', () => {
    expect(validateBookingDraft({ ...draft, childrenCount: 1 }, fixedNow)).toEqual([])
    expect(validateBookingDraft({ ...draft, childrenCount: 8 }, fixedNow)).toEqual([])
    for (const childrenCount of [0, 9, 1.5, Number.NaN]) {
      expect(validateBookingDraft({ ...draft, childrenCount }, fixedNow)).toContain('Укажите количество детей от 1 до 8.')
    }
  })

  test('creates a local demo record using the server quote without calculating a tariff', () => {
    const now = new Date('2030-05-01T10:00:00.000Z')
    const order = createDemoOrder(draft, 3275, now)
    expect(order.id).toMatch(/^WIMI-DEMO-/)
    expect(order.status).toBe('CREATED')
    expect(order.createdAt).toBe(now.toISOString())
    expect(order.estimatedTotalCents).toBe(3275)
    expect(order.address).toBe(draft.address)
    expect(order.childrenCount).toBe(1)
    expect(order.notes).toBe('')
  })

  test('rejects an invalid quote amount when creating a demo record', () => {
    expect(() => createDemoOrder(draft, Number.NaN, fixedNow)).toThrow('Не получена корректная предварительная цена сервера.')
    expect(() => createDemoOrder(draft, -1, fixedNow)).toThrow('Не получена корректная предварительная цена сервера.')
    expect(() => createDemoOrder({ ...draft, address: ' ' }, 3000, fixedNow)).toThrow('Укажите адрес оказания услуги.')
  })
})
