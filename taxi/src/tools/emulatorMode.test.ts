import {
  filterOrdersForBrowserEmulator,
} from './emulatorMode'

const backendTestOrder = {
  b_id: '16762',
  b_custom_comment: 'тестовый клиентский заказ',
} as any

describe('filterOrdersForBrowserEmulator — external emulator mode', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, '', '/driver-order')
  })

  it('keeps emulator-marked backend orders when driverEmulator=1', () => {
    window.history.replaceState({}, '', '/driver-order?driverEmulator=1')

    expect(filterOrdersForBrowserEmulator([backendTestOrder])).toEqual([backendTestOrder])
  })

  it('supports the extEmulator=1 alias', () => {
    window.history.replaceState({}, '', '/driver-order?extEmulator=1')

    expect(filterOrdersForBrowserEmulator([backendTestOrder])).toEqual([backendTestOrder])
  })

  it('continues hiding emulator-marked orders in normal mode', () => {
    expect(filterOrdersForBrowserEmulator([backendTestOrder])).toEqual([])
  })
})
