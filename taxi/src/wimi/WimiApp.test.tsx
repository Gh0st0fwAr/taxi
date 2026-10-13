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

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import WimiRoot from './WimiApp'

let container: HTMLDivElement
let root: Root

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
  })

  test('keeps an invalid draft on the form and exposes an accessible error', async () => {
    await clickButton('Проверить заказ')
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.querySelector('h1')?.textContent).toBe('Найдём время для заботы')
    expect(container.querySelector<HTMLLabelElement>('label[for="wimi-address"]')?.htmlFor).toBe('wimi-address')
  })

  test('gets the quote from the server and preserves edited values on back-navigation', async () => {
    changeValue('#wimi-address', 'Демо-адрес, 1')
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

  test('creates one in-memory demo result from the server quote and can reset', async () => {
    changeValue('#wimi-address', 'Демо-адрес, 2')
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
    changeValue('#wimi-address', 'Первый адрес')
    await clickButton('Проверить заказ')
    await clickButton('Назад к данным')
    changeValue('#wimi-address', 'Последний адрес')
    await clickButton('Проверить заказ')
    expect(container.textContent).toContain('Последний адрес')
    expect(container.textContent).not.toContain('Первый адрес')
  })
})
