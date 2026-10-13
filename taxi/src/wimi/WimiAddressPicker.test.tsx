declare const describe: (name: string, fn: () => void) => void
declare const test: (name: string, fn: () => void) => void
declare const expect: (actual: unknown) => any
declare const beforeEach: (fn: () => void) => void
declare const afterEach: (fn: () => void) => void
declare const jest: { mock: (name: string, factory: () => unknown) => void }

jest.mock('../API', () => ({
  getPointSuggestions: () => Promise.resolve([]),
  geocode: () => Promise.resolve(null),
  reverseGeocode: (latitude: string, longitude: string) => Promise.resolve({
    display_name: `Выбранная точка ${latitude}, ${longitude}`,
  }),
}))

jest.mock('react-leaflet', () => {
  const React = require('react')
  const mockMap = {
    getCenter: () => ({ lat: 35.7595, lng: -5.834 }),
  }
  return {
    MapContainer: (props: { children?: React.ReactNode; className?: string }) =>
      React.createElement('div', { className: props.className, 'data-testid': 'leaflet-map' }, props.children),
    TileLayer: () => null,
    useMap: () => mockMap,
    useMapEvents: () => null,
  }
})

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import WimiAddressPicker from './WimiAddressPicker'
import type { WimiSelectedAddress } from './WimiAddressPicker'

let container: HTMLDivElement
let root: Root
let selected: WimiSelectedAddress | null

async function clickButton(label: string): Promise<void> {
  const button = Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes(label))
  if (!button) throw new Error(`Button not found: ${label}`)
  await act(async () => {
    button.click()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('WIMI address map picker', () => {
  beforeEach(() => {
    selected = null
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(
      <WimiAddressPicker
        value="Существующий адрес"
        latitude={35.7}
        longitude={-5.8}
        onChange={() => undefined}
        onSelect={point => { selected = point }}
      />,
    ))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  test('requires an explicit confirmation of the map center and saves reverse-geocoded coordinates', async () => {
    await clickButton('Выбрать на карте')
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(selected).toBeNull()

    await clickButton('Выбрать эту точку')
    expect(selected).toEqual({
      address: 'Выбранная точка 35.7595, -5.834',
      latitude: 35.7595,
      longitude: -5.834,
    })
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})
