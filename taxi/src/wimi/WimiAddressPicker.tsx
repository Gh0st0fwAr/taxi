import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { geocode, getPointSuggestions, reverseGeocode } from '../API'
import SITE_CONSTANTS from '../siteConstants'
import { getAttribution, getTileServerUrl } from '../tools/utils'
import { IAddressPoint, ISuggestion } from '../types/types'

export interface WimiSelectedAddress {
  address: string
  latitude: number
  longitude: number
}

interface WimiAddressPickerProps {
  value: string
  latitude?: number
  longitude?: number
  onChange: (value: string) => void
  onSelect: (point: WimiSelectedAddress) => void
}

const isValidCoordinates = (latitude: unknown, longitude: unknown): latitude is number =>
  typeof latitude === 'number' &&
  Number.isFinite(latitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  typeof longitude === 'number' &&
  Number.isFinite(longitude) &&
  longitude >= -180 &&
  longitude <= 180

const getPointCoordinates = (point?: IAddressPoint | null): [number, number] | null => {
  if (!point || !isValidCoordinates(point.latitude, point.longitude))
    return null
  return [point.latitude, point.longitude]
}

const getPlaceCoordinates = (place: { lat?: unknown; lon?: unknown } | null | undefined): [number, number] | null => {
  const latitude = typeof place?.lat === 'string' ? Number(place.lat) : place?.lat
  const longitude = typeof place?.lon === 'string' ? Number(place.lon) : place?.lon
  return isValidCoordinates(latitude, longitude) ? [latitude, longitude] : null
}

function MapCenterReporter({ onCenterChange }: { onCenterChange: (center: [number, number]) => void }) {
  const map = useMap()

  useEffect(() => {
    const center = map.getCenter()
    onCenterChange([center.lat, center.lng])
  }, [map, onCenterChange])

  useMapEvents({
    moveend: event => {
      const center = event.target.getCenter()
      onCenterChange([center.lat, center.lng])
    },
  })

  return null
}

const WimiAddressPicker: React.FC<WimiAddressPickerProps> = ({
  value,
  latitude,
  longitude,
  onChange,
  onSelect,
}) => {
  const [suggestions, setSuggestions] = useState<ISuggestion[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [mapError, setMapError] = useState('')
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [isMapLoading, setIsMapLoading] = useState(false)
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)
  const searchRequestId = useRef(0)
  const mapRequestId = useRef(0)
  const selectedAddressRef = useRef('')

  useEffect(() => {
    const query = value.trim()
    const requestId = ++searchRequestId.current

    if (query.length < 3 || query === selectedAddressRef.current) {
      setSuggestions([])
      setIsSearching(false)
      setSearchError('')
      return undefined
    }

    let cancelled = false
    setIsSearching(true)
    setSearchError('')
    const timer = window.setTimeout(() => {
      getPointSuggestions(query)
        .then(items => {
          if (cancelled || requestId !== searchRequestId.current)
            return
          setSuggestions(items.filter(item => Boolean(item.point)))
        })
        .catch(() => {
          if (cancelled || requestId !== searchRequestId.current)
            return
          setSuggestions([])
          setSearchError('Не удалось загрузить подсказки. Можно уточнить адрес или выбрать точку на карте.')
        })
        .finally(() => {
          if (!cancelled && requestId === searchRequestId.current)
            setIsSearching(false)
        })
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [value])

  const selectPoint = (point: WimiSelectedAddress) => {
    selectedAddressRef.current = point.address
    setSuggestions([])
    setSearchError('')
    setMapError('')
    onSelect(point)
  }

  const handleSuggestionSelect = async (suggestion: ISuggestion) => {
    const point = suggestion.point
    if (!point)
      return

    const address = String(point.address || point.shortAddress || value).trim()
    const coordinates = getPointCoordinates(point)
    if (coordinates && address) {
      selectPoint({ address, latitude: coordinates[0], longitude: coordinates[1] })
      return
    }

    if (!address) {
      setSearchError('В подсказке нет адреса. Уточните запрос или выберите точку на карте.')
      return
    }

    const requestId = ++searchRequestId.current
    setIsResolving(true)
    setSearchError('')
    try {
      const place = await geocode(address, { details: true })
      if (requestId !== searchRequestId.current)
        return
      const resolvedCoordinates = getPlaceCoordinates(place)
      const resolvedAddress = String(place?.display_name || address).trim()
      if (!place || !resolvedCoordinates || !resolvedAddress)
        throw new Error('Address suggestion has no coordinates')
      selectPoint({
        address: resolvedAddress,
        latitude: resolvedCoordinates[0],
        longitude: resolvedCoordinates[1],
      })
    } catch {
      if (requestId === searchRequestId.current)
        setSearchError('Не удалось определить координаты этого адреса. Выберите другую подсказку или точку на карте.')
    } finally {
      if (requestId === searchRequestId.current)
        setIsResolving(false)
    }
  }

  const getInitialMapCenter = async (): Promise<[number, number]> => {
    const selectedCoordinates = isValidCoordinates(latitude, longitude) ?
      [latitude, longitude] as [number, number] :
      null
    if (selectedCoordinates)
      return selectedCoordinates

    const query = value.trim()
    if (query.length >= 3) {
      try {
        const place = await geocode(query, { details: true })
        const coordinates = getPlaceCoordinates(place)
        if (coordinates)
          return coordinates
      } catch {
        // A typed address is only a search hint. Continue to a neutral map center.
      }
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          })
        })
        if (isValidCoordinates(position.coords.latitude, position.coords.longitude))
          return [position.coords.latitude, position.coords.longitude]
      }
    } catch {
      // Device location is used only to center the map, never as the selected service point.
    }

    const fallback = SITE_CONSTANTS.DEFAULT_POSITION
    return isValidCoordinates(fallback[0], fallback[1]) ? fallback : [0, 0]
  }

  const openMap = async () => {
    const requestId = ++mapRequestId.current
    setIsMapOpen(true)
    setIsMapLoading(true)
    setMapError('')
    try {
      const center = await getInitialMapCenter()
      if (requestId === mapRequestId.current)
        setMapCenter(center)
    } finally {
      if (requestId === mapRequestId.current)
        setIsMapLoading(false)
    }
  }

  const closeMap = () => {
    mapRequestId.current += 1
    setIsMapOpen(false)
    setIsMapLoading(false)
  }

  const chooseMapCenter = async () => {
    if (!mapCenter || !isValidCoordinates(mapCenter[0], mapCenter[1]))
      return

    const [pointLatitude, pointLongitude] = mapCenter
    setIsResolving(true)
    setMapError('')
    try {
      const place = await reverseGeocode(String(pointLatitude), String(pointLongitude))
      const address = String(place?.display_name || '').trim()
      if (!address)
        throw new Error('Reverse geocoder returned no address')
      selectPoint({ address, latitude: pointLatitude, longitude: pointLongitude })
    } catch {
      const coordinateLabel = `Точка на карте (${pointLatitude.toFixed(5)}, ${pointLongitude.toFixed(5)})`
      selectPoint({ address: coordinateLabel, latitude: pointLatitude, longitude: pointLongitude })
      setMapError('Адрес не распознан. Выбранная точка и координаты сохранены; проверьте адрес перед продолжением.')
    } finally {
      setIsResolving(false)
      closeMap()
    }
  }

  const hasSelectedCoordinates = isValidCoordinates(latitude, longitude)

  return (
    <div className="wimi-address-picker">
      <div className="wimi-address-input-row">
        <input
          id="wimi-address"
          autoComplete="street-address"
          value={value}
          onChange={event => {
            selectedAddressRef.current = ''
            setSearchError('')
            setMapError('')
            onChange(event.target.value)
          }}
          placeholder="Улица, дом, город"
          required
          aria-describedby="wimi-address-help"
          aria-invalid={Boolean(searchError)}
        />
        <button type="button" className="wimi-button wimi-button-secondary wimi-map-open-button" onClick={openMap}>
          Выбрать на карте
        </button>
      </div>
      <small id="wimi-address-help" className="wimi-address-help">
        Выберите адрес из подсказок или отметьте точку на карте. Одного текста без координат недостаточно.
      </small>

      {isSearching && <p className="wimi-address-status" role="status">Ищем адреса…</p>}
      {isResolving && <p className="wimi-address-status" role="status">Определяем адрес и координаты…</p>}
      {searchError && <p className="wimi-address-error" role="alert">{searchError}</p>}
      {mapError && <p className="wimi-address-error" role="status">{mapError}</p>}
      {hasSelectedCoordinates && (
        <p className="wimi-address-selected" role="status">
          Точка выбрана · {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </p>
      )}

      {suggestions.length > 0 && (
        <ul className="wimi-address-suggestions" aria-label="Подсказки адреса">
          {suggestions.map((suggestion, index) => {
            const label = String(suggestion.point?.shortAddress || suggestion.point?.address || '').trim()
            return (
              <li key={`${label}-${index}`}>
                <button
                  type="button"
                  onClick={() => { void handleSuggestionSelect(suggestion) }}
                  disabled={isResolving}
                >
                  <span>{label || 'Адрес без названия'}</span>
                  {suggestion.distance !== undefined && <small>{Math.round(suggestion.distance)} м</small>}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {isMapOpen && (
        <div className="wimi-map-backdrop" role="presentation">
          <section className="wimi-map-dialog" role="dialog" aria-modal="true" aria-labelledby="wimi-map-title">
            <header className="wimi-map-dialog-header">
              <div>
                <h2 id="wimi-map-title">Выберите точку услуги</h2>
                <p>Передвигайте карту так, чтобы маркер оказался над нужным местом.</p>
              </div>
              <button type="button" className="wimi-button wimi-button-secondary" onClick={closeMap}>Закрыть</button>
            </header>
            <div className="wimi-map-canvas">
              {isMapLoading || !mapCenter ? (
                <p className="wimi-map-loading" role="status">Подготавливаем карту…</p>
              ) : (
                <>
                  <MapContainer center={mapCenter} zoom={15} scrollWheelZoom className="wimi-leaflet-map">
                    <TileLayer attribution={getAttribution()} url={getTileServerUrl()} updateWhenIdle updateWhenZooming={false} keepBuffer={2} />
                    <MapCenterReporter onCenterChange={setMapCenter} />
                  </MapContainer>
                  <div className="wimi-map-center-pin" aria-hidden="true"><span /></div>
                </>
              )}
            </div>
            <footer className="wimi-map-dialog-footer">
              <small>Местоположение телефона, если использовано для центрирования, не считается выбранным адресом.</small>
              <button type="button" className="wimi-button wimi-button-primary" onClick={() => { void chooseMapCenter() }} disabled={isMapLoading || !mapCenter || isResolving}>
                {isResolving ? 'Определяем адрес…' : 'Выбрать эту точку'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}

export default WimiAddressPicker
