// React DOM tests are used here so no additional testing dependency is needed.
declare const describe: (name: string, fn: () => void) => void
declare const test: (name: string, fn: () => void) => void
declare const expect: (actual: unknown) => any
declare const beforeEach: (fn: () => void) => void
declare const afterEach: (fn: () => void) => void
declare const jest: { mock: (name: string, factory: () => unknown) => void }

jest.mock('./nannyPricingApi', () => ({
  getNannyPricingQuote: () => Promise.resolve({ formula: 'base_price', price: '30', options: {}, calculationType: 'complete' }),
}))

jest.mock('./nannyOrderApi', () => ({
  createNannyOrder: () => Promise.resolve({ orderId: '4200', duplicate: false, pricingModel: { price: '30', calculationType: 'complete' } }),
  isWimiRealOrderCreationEnabled: () => process.env.REACT_APP_WIMI_ENABLE_REAL_CREATE === 'true',
}))

jest.mock('../API', () => ({
  getPointSuggestions: (query: string) => {
    if (query === 'Сбой адреса')
      return Promise.reject(new Error('suggestions unavailable'))
    const result = [{
      type: 2,
      point: { address: query, shortAddress: query, latitude: 5.55602, longitude: -0.1969 },
    }]
    return query === 'Медленный адрес' ?
      new Promise(resolve => setTimeout(() => resolve(result), 300)) :
      Promise.resolve(result)
  },
  geocode: (query: string) => Promise.resolve({
    display_name: query,
    lat: '5.55602',
    lon: '-0.1969',
    address: {},
  }),
  reverseGeocode: (latitude: string, longitude: string) => Promise.resolve({
    display_name: `Точка ${latitude}, ${longitude}`,
  }),
}))


jest.mock('react-leaflet', () => {
  const React = require('react')
  const mockMap = { getCenter: () => ({ lat: 35.7595, lng: -5.834 }) }
  return {
    MapContainer: (props: { children?: React.ReactNode; className?: string }) =>
      React.createElement('div', { className: props.className, 'data-testid': 'leaflet-map' }, props.children),
    TileLayer: () => null,
    useMap: () => mockMap,
    useMapEvents: () => null,
  }
})

jest.mock('../tools/utils', () => ({
  getAttribution: () => 'Map attribution',
  getTileServerUrl: () => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
}))

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import WimiRoot from './WimiApp'

let container: HTMLDivElement
let root: Root
const originalRealCreateFlag = process.env.REACT_APP_WIMI_ENABLE_REAL_CREATE

async function clickButton(label: string): Promise<void> {
  const button = Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes(label))
  if (!button) throw new Error(`Button not found: ${label}`)
  await act(async () => {
    button.click()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function changeValue(selector: string, value: string): void {
  const element = container.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)
  if (!element) throw new Error(`Form control not found: ${selector}`)
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  if (setter) setter.call(element, value)
  else element.value = value
  act(() => {
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

async function selectAddress(value: string): Promise<void> {
  changeValue('#wimi-address', value)
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 400))
  })
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('.wimi-address-suggestions button'))
    .find(item => item.textContent?.includes(value))
  if (!button) throw new Error(`Address suggestion not found: ${value}`)
  await act(async () => {
    button.click()
    await Promise.resolve()
  })
}

describe('WIMI booking UI', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<MemoryRouter><WimiRoot /></MemoryRouter>))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    if (originalRealCreateFlag === undefined) delete process.env.REACT_APP_WIMI_ENABLE_REAL_CREATE
    else process.env.REACT_APP_WIMI_ENABLE_REAL_CREATE = originalRealCreateFlag
  })

  test('keeps an invalid draft on the form and exposes an accessible error', async () => {
    await clickButton('Проверить заказ')
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.querySelector('h1')?.textContent).toBe('Найдём время для заботы')
    expect(container.querySelector<HTMLLabelElement>('label[for="wimi-address"]')?.htmlFor).toBe('wimi-address')
  })


  test('shows a recoverable message when address suggestions fail', async () => {
    changeValue('#wimi-address', 'Сбой адреса')
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 400))
    })
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Не удалось загрузить подсказки')
    expect(container.querySelector<HTMLInputElement>('#wimi-address')?.value).toBe('Сбой адреса')
  })

  test('does not display a late response for an older address query', async () => {
    changeValue('#wimi-address', 'Медленный адрес')
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 400))
    })
    changeValue('#wimi-address', 'Новый адрес')
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 400))
    })
    expect(container.querySelector('.wimi-address-suggestions')?.textContent).toContain('Новый адрес')
    expect(container.querySelector('.wimi-address-suggestions')?.textContent).not.toContain('Медленный адрес')
  })

  test('requires a coordinate-backed address and clears coordinates when the text is edited', async () => {
    await selectAddress('Подтверждённый адрес')
    expect(container.querySelector('.wimi-address-selected')?.textContent).toContain('5.55602, -0.19690')
    changeValue('#wimi-address', 'Изменённый адрес')
    expect(container.querySelector('.wimi-address-selected')).toBeNull()
    await clickButton('Проверить заказ')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Выберите адрес из подсказок или отметьте точку на карте.')
  })

  test('gets the quote from the server and preserves edited values on back-navigation', async () => {
    await selectAddress('Демо-адрес, 1')
    changeValue('#wimi-duration', '121')
    expect(container.querySelector('.wimi-price-preview strong')?.textContent).toContain('После проверки')
    changeValue('#wimi-duration', '130')
    changeValue('#wimi-duration', '131')
    await clickButton('Проверить заказ')
    expect(container.querySelector('h1')?.textContent).toBe('Проверьте детали заказа')
    expect(container.textContent).toContain('Демо-адрес, 1')
    expect(container.textContent).toContain('30,00')
    await clickButton('Назад к данным')
    expect(container.querySelector<HTMLInputElement>('#wimi-address')?.value).toBe('Демо-адрес, 1')
    expect(container.querySelector<HTMLInputElement>('#wimi-duration')?.value).toBe('131')
  })

  test('submits a real server order only when the release flag is enabled', async () => {
    process.env.REACT_APP_WIMI_ENABLE_REAL_CREATE = 'true'
    await selectAddress('Серверный адрес, 1')
    await clickButton('Проверить заказ')
    await clickButton('Создать заявку')
    expect(container.querySelector('.wimi-order-id')?.textContent).toBe('4200')
    expect(container.textContent).toContain('ЗАЯВКА СОЗДАНА НА СЕРВЕРЕ')
    expect(container.textContent).toContain('Сервер подтвердил создание заявки')
    expect(container.textContent).not.toContain('Реальная заявка не отправлена')
  })

  test('creates one in-memory demo result from the server quote and can reset', async () => {
    await selectAddress('Демо-адрес, 2')
    await clickButton('Проверить заказ')
    act(() => {
      const button = Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes('Создать демо-заказ'))
      if (!button) throw new Error('Create button not found')
      button.click()
      button.click()
    })
    expect(container.querySelectorAll('.wimi-order-id')).toHaveLength(1)
    expect(container.textContent).toContain('Реальная заявка не отправлена')
    expect(container.textContent).toContain('Демонстрационный режим')
    await clickButton('Создать ещё один демо-заказ')
    expect(container.querySelector('.wimi-order-id')).toBeNull()
    expect(container.querySelector<HTMLInputElement>('#wimi-address')?.value).toBe('')
    expect(container.textContent).toContain('Демонстрационный режим')
  })

  test('shows the latest edited data after rechecking the draft', async () => {
    await selectAddress('Первый адрес')
    await clickButton('Проверить заказ')
    await clickButton('Назад к данным')
    await selectAddress('Последний адрес')
    await clickButton('Проверить заказ')
    expect(container.textContent).toContain('Последний адрес')
    expect(container.textContent).not.toContain('Первый адрес')
  })
})
