import React, { FormEvent, useRef, useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import {
  createDemoOrder,
  validateBookingDraft,
  WimiBookingDraft,
  WimiDemoOrder,
} from './mockAdapter'
import { getNannyPricingQuote } from './nannyPricingApi'
import { createNannyOrder, isWimiRealOrderCreationEnabled } from './nannyOrderApi'
import WimiAddressPicker from './WimiAddressPicker'
import type { WimiSelectedAddress } from './WimiAddressPicker'

function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function money(cents: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

function createRequestKey(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID()
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

const initialDraft = (): WimiBookingDraft => ({
  address: '',
  date: localDateString(new Date(Date.now() + 24 * 60 * 60 * 1000)),
  startTime: '10:00',
  durationMinutes: 120,
  childrenCount: 1,
  childrenAges: '',
  notes: '',
})

const WimiApp: React.FC = () => {
  const [draft, setDraft] = useState<WimiBookingDraft>(initialDraft)
  const [order, setOrder] = useState<WimiDemoOrder | null>(null)
  const [realOrderId, setRealOrderId] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [step, setStep] = useState<'details' | 'review' | 'created'>('details')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isQuoting, setIsQuoting] = useState(false)
  const [serverQuoteCents, setServerQuoteCents] = useState<number | null>(null)
  const submittingRef = useRef(false)
  const quoteRequestIdRef = useRef(0)
  const createRequestKeyRef = useRef<string | null>(null)
  const navigate = useNavigate()

  const update = <K extends keyof WimiBookingDraft>(key: K, value: WimiBookingDraft[K]) => {
    createRequestKeyRef.current = null
    if (key === 'address') {
      setDraft(current => ({
        ...current,
        address: value as string,
        latitude: undefined,
        longitude: undefined,
      }))
    } else {
      setDraft(current => ({ ...current, [key]: value }))
    }

    if (key === 'address' || key === 'date' || key === 'startTime' || key === 'durationMinutes') {
      quoteRequestIdRef.current += 1
      setServerQuoteCents(null)
      setIsQuoting(false)
    }
  }

  const selectAddressPoint = (point: WimiSelectedAddress) => {
    createRequestKeyRef.current = null
    quoteRequestIdRef.current += 1
    setDraft(current => ({
      ...current,
      address: point.address,
      latitude: point.latitude,
      longitude: point.longitude,
    }))
    setServerQuoteCents(null)
    setIsQuoting(false)
    setErrors([])
  }

  const review = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (step !== 'details' || isQuoting) return
    const nextErrors = validateBookingDraft(draft)
    setErrors(nextErrors)
    if (nextErrors.length > 0) return

    const requestId = ++quoteRequestIdRef.current
    setIsQuoting(true)
    try {
      const quote = await getNannyPricingQuote(draft.date, draft.startTime, draft.durationMinutes)
      if (requestId !== quoteRequestIdRef.current) return
      const quotedCents = Math.round(Number(quote.price) * 100)
      if (!Number.isSafeInteger(quotedCents) || quotedCents < 0) {
        throw new Error('Invalid server quote')
      }
      setServerQuoteCents(quotedCents)
      setErrors([])
      setStep('review')
    } catch (error) {
      if (requestId !== quoteRequestIdRef.current) return
      const message = error instanceof Error ? error.message : ''
      const minimumDuration = /minimum duration is (\d+) minutes/i.exec(message)
      setErrors([message.includes('Unauthorized')
        ? 'Для запроса цены войдите в аккаунт WIMI KIDS на этой платформе.'
        : minimumDuration
          ? `Минимальная длительность по правилам сервиса — ${minimumDuration[1]} минут. Заказ не создан.`
          : 'Не удалось получить цену с сервера. Заказ не создан. Проверьте соединение и попробуйте ещё раз.'])
    } finally {
      if (requestId === quoteRequestIdRef.current)
        setIsQuoting(false)
    }
  }

  const submitDemoOrder = async () => {
    // Guard synchronously: React state alone does not block two events before a render.
    if (step !== 'review' || submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)

    try {
      const nextErrors = validateBookingDraft(draft)
      if (nextErrors.length > 0) {
        setErrors(nextErrors)
        setStep('details')
        submittingRef.current = false
        setIsSubmitting(false)
        return
      }

      if (serverQuoteCents === null) throw new Error('Server quote is missing')
      if (isWimiRealOrderCreationEnabled()) {
        if (typeof draft.latitude !== 'number' || typeof draft.longitude !== 'number') {
          throw new Error('Выберите адрес с подтверждёнными координатами.')
        }
        // Keep the same key after a timeout/error so a retry can recover the same server order.
        const requestKey = createRequestKeyRef.current ?? createRequestKey()
        createRequestKeyRef.current = requestKey
        const result = await createNannyOrder({
          latitude: draft.latitude,
          longitude: draft.longitude,
          date: draft.date,
          startTime: draft.startTime,
          durationMinutes: draft.durationMinutes,
          childrenCount: draft.childrenCount,
        }, requestKey)
        setRealOrderId(result.orderId)
        setOrder(null)
      } else {
        setOrder(createDemoOrder(draft, serverQuoteCents))
        setRealOrderId(null)
      }
      setErrors([])
      setStep('created')
      // Keep the guard locked until the user explicitly starts a new order.
    } catch (error) {
      setErrors([error instanceof Error
        ? error.message
        : 'Не удалось создать заявку. Проверьте соединение и попробуйте ещё раз.'])
      // Keep the review data and idempotency key so the user can safely retry.
      setStep('review')
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const reset = () => {
    submittingRef.current = false
    quoteRequestIdRef.current += 1
    setIsSubmitting(false)
    setIsQuoting(false)
    setDraft(initialDraft())
    setOrder(null)
    setRealOrderId(null)
    createRequestKeyRef.current = null
    setServerQuoteCents(null)
    setErrors([])
    setStep('details')
    navigate('/')
  }

  return (
    <div className="wimi-shell">
      <header className="wimi-header">
        <Link to="/" className="wimi-brand" aria-label="WIMI KIDS — главная">
          <span className="wimi-brand-mark">W</span>
          <span><strong>WIMI KIDS</strong><small>Помощь с заботой о детях</small></span>
        </Link>
        <span className="wimi-header-label">Заказ няни</span>
      </header>

      <main className="wimi-main">
        <div className="wimi-demo-notice" role="status">
          <strong>{isWimiRealOrderCreationEnabled() ? 'Режим создания заявок' : 'Демонстрационный режим'}</strong>
          <span>{isWimiRealOrderCreationEnabled()
            ? 'Заявка будет отправлена на сервер после проверки данных.'
            : 'Реальный заказ не отправляется. Не вводите настоящие персональные данные.'}</span>
        </div>

        {step === 'created' && (order || realOrderId) ? (
          <section className="wimi-card wimi-result" aria-labelledby="created-title">
            <div className="wimi-success-icon" aria-hidden="true">✓</div>
            <p className="wimi-eyebrow">{realOrderId ? 'ЗАЯВКА СОЗДАНА НА СЕРВЕРЕ' : 'ДЕМО-ЗАКАЗ СОЗДАН ЛОКАЛЬНО'}</p>
            <h1 id="created-title">{realOrderId ? 'Заявка создана' : 'Проверка сценария завершена'}</h1>
            <p className="wimi-muted">{realOrderId
              ? 'Сервер подтвердил создание заявки. Назначение няни и дальнейшие уведомления этим действием не подтверждаются.'
              : 'Это тестовая запись только в памяти открытой страницы. Реальная заявка не отправлена, няня не назначена, уведомления не отправлены.'}</p>
            <div className="wimi-order-id">{realOrderId ?? order?.id}</div>
            <div className="wimi-summary">
              <SummaryRow label="Адрес" value={order?.address ?? draft.address} />
              {typeof (order?.latitude ?? draft.latitude) === 'number' && typeof (order?.longitude ?? draft.longitude) === 'number' && (
                <SummaryRow label="Координаты" value={`${(order?.latitude ?? draft.latitude)!.toFixed(5)}, ${(order?.longitude ?? draft.longitude)!.toFixed(5)}`} />
              )}
              <SummaryRow label="Дата" value={order?.date ?? draft.date} />
              <SummaryRow label="Начало" value={order?.startTime ?? draft.startTime} />
              <SummaryRow label="Длительность" value={`${order?.durationMinutes ?? draft.durationMinutes} минут`} />
              <SummaryRow label="Дети" value={String(order?.childrenCount ?? draft.childrenCount)} />
              <SummaryRow label="Возраст" value={(order?.childrenAges ?? draft.childrenAges) || 'Не указан'} />
              <SummaryRow label="Комментарий" value={(order?.notes ?? draft.notes) || 'Нет'} />
              <SummaryRow label="Предварительная цена сервера" value={money(order?.estimatedTotalCents ?? serverQuoteCents ?? 0)} />
            </div>
            <p className="wimi-disclaimer">{realOrderId
              ? 'Показана предварительная цена из серверного quote. Окончательная сумма определяется сервером по фактическим данным.'
              : 'Предварительная сумма получена с сервера. Это всё ещё демо-запись: реальный заказ не создан, а окончательная цена зависит от фактического времени. Данные не сохраняются после обновления или закрытия страницы.'}</p>
            <button type="button" className="wimi-button wimi-button-primary wimi-full" onClick={reset}>{realOrderId ? 'Создать новую заявку' : 'Создать ещё один демо-заказ'}</button>
          </section>
        ) : (
          <>
            <section className="wimi-intro">
              <p className="wimi-eyebrow">WIMI KIDS · СЕРВИС ВЫЗОВА НЯНЬ</p>
              <h1>{step === 'review' ? 'Проверьте детали заказа' : 'Найдём время для заботы'}</h1>
              <p className="wimi-muted">{step === 'review' ? 'Перед отправкой проверьте адрес, время и предварительную сумму.' : 'Укажите основные детали — перед проверкой веб-версия запросит цену у сервера.'}</p>
            </section>

            <div className="wimi-steps" aria-label="Этапы заказа">
              <div className={step === 'details' ? 'wimi-step is-active' : 'wimi-step is-done'}><span>1</span><div><strong>Детали</strong><small>Услуга и время</small></div></div>
              <div className={step === 'review' ? 'wimi-step is-active' : 'wimi-step'}><span>2</span><div><strong>Проверка</strong><small>Сумма и данные</small></div></div>
              <div className="wimi-step"><span>3</span><div><strong>Готово</strong><small>Результат</small></div></div>
            </div>

            {errors.length > 0 && (
              <div className="wimi-errors" role="alert" aria-live="assertive">
                <strong>Проверьте данные:</strong>
                <ul>{errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul>
              </div>
            )}

            {step === 'details' ? (
              <form className="wimi-card" onSubmit={review} noValidate>
                <div className="wimi-card-heading"><span className="wimi-heading-icon" aria-hidden="true">⌂</span><div><h2>Где и когда нужна няня?</h2><p>Время указывается по месту оказания услуги.</p></div></div>
                <div className="wimi-field">
                  <label htmlFor="wimi-address">Адрес оказания услуги <span>*</span></label>
                  <WimiAddressPicker
                    value={draft.address}
                    latitude={draft.latitude}
                    longitude={draft.longitude}
                    onChange={value => update('address', value)}
                    onSelect={selectAddressPoint}
                  />
                </div>
                <div className="wimi-grid-two">
                  <div className="wimi-field">
                    <label htmlFor="wimi-date">Дата <span>*</span></label>
                    <input id="wimi-date" type="date" min={localDateString(new Date())} value={draft.date} onChange={event => update('date', event.target.value)} required />
                  </div>
                  <div className="wimi-field">
                    <label htmlFor="wimi-time">Время начала <span>*</span></label>
                    <input id="wimi-time" type="time" min="06:00" max="22:00" value={draft.startTime} onChange={event => update('startTime', event.target.value)} required />
                    <small>Заказы принимаются с 06:00 до 22:00. Начало в 22:00 не подходит для минимального заказа.</small>
                  </div>
                </div>
                <p className="wimi-field-hint">Проверка использует локальные часы браузера. Часовой пояс адреса и переходы на летнее время сервером пока не проверяются.</p>
                <div className="wimi-field">
                  <label htmlFor="wimi-duration">Длительность, минут <span>*</span></label>
                  <input id="wimi-duration" type="number" min="1" max="1080" step="1" value={draft.durationMinutes} onChange={event => update('durationMinutes', event.target.value === '' ? Number.NaN : Number(event.target.value))} required />
                  <small>Минимальную длительность проверит сервер. Заказ должен завершиться не позднее 00:00.</small>
                </div>

                <div className="wimi-card-heading wimi-section-divider"><span className="wimi-heading-icon" aria-hidden="true">♡</span><div><h2>О детях</h2><p>Не указывайте имена и другие лишние персональные данные.</p></div></div>
                <div className="wimi-grid-two">
                  <div className="wimi-field">
                    <label htmlFor="wimi-count">Количество детей <span>*</span></label>
                    <select id="wimi-count" value={draft.childrenCount} onChange={event => update('childrenCount', Number(event.target.value))}>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(count => <option value={count} key={count}>{count}</option>)}
                    </select>
                  </div>
                  <div className="wimi-field">
                    <label htmlFor="wimi-ages">Возраст детей</label>
                    <input id="wimi-ages" value={draft.childrenAges} onChange={event => update('childrenAges', event.target.value)} placeholder="Например: 3 и 6 лет" />
                  </div>
                </div>
                <div className="wimi-field">
                  <label htmlFor="wimi-notes">Комментарий (необязательно)</label>
                  <textarea id="wimi-notes" rows={3} value={draft.notes} onChange={event => update('notes', event.target.value)} placeholder="Особенности задачи без медицинских и других чувствительных данных" />
                </div>

                <div className="wimi-price-preview">
                  <div><span>Цена сервера</span><small>Получим при проверке заказа. Клиентская версия не рассчитывает тариф самостоятельно.</small></div>
                  <strong>После проверки</strong>
                </div>
                <p className="wimi-disclaimer">Предварительная цена получена сервером. Создание остаётся демонстрационным; окончательная сумма определяется сервером по фактическому времени. Оплата — наличными няне вне сервиса.</p>
                <button type="submit" className="wimi-button wimi-button-primary wimi-full" disabled={isQuoting}>{isQuoting ? 'Запрашиваем цену…' : 'Проверить заказ'} <span aria-hidden="true">→</span></button>
              </form>
            ) : (
              <section className="wimi-card" aria-labelledby="wimi-review-title">
                <div className="wimi-card-heading"><span className="wimi-heading-icon" aria-hidden="true">✓</span><div><h2 id="wimi-review-title">Детали демо-заказа</h2><p>Сверьте данные и предварительную цену, полученную с сервера.</p></div></div>
                <div className="wimi-summary">
                  <SummaryRow label="Адрес" value={draft.address} />
                  {typeof draft.latitude === 'number' && typeof draft.longitude === 'number' && (
                    <SummaryRow label="Координаты" value={`${draft.latitude.toFixed(5)}, ${draft.longitude.toFixed(5)}`} />
                  )}
                  <SummaryRow label="Дата" value={draft.date} />
                  <SummaryRow label="Время начала" value={draft.startTime} />
                  <SummaryRow label="Длительность" value={`${draft.durationMinutes} минут`} />
                  <SummaryRow label="Количество детей" value={String(draft.childrenCount)} />
                  <SummaryRow label="Возраст" value={draft.childrenAges || 'Не указан'} />
                  <SummaryRow label="Комментарий" value={draft.notes || 'Нет'} />
                  <SummaryRow label="Предварительная цена сервера" value={serverQuoteCents === null ? 'Не получена' : money(serverQuoteCents)} />
                </div>
                <p className="wimi-disclaimer">Цена получена через nanny_pricing. Реальное создание по умолчанию выключено до подтверждения корректного серверного расчёта длительности и проверки staging.</p>
                <div className="wimi-actions">
                  <button type="button" className="wimi-button wimi-button-secondary" onClick={() => { setErrors([]); setStep('details') }}>Назад к данным</button>
                  <button type="button" className="wimi-button wimi-button-primary" onClick={submitDemoOrder} disabled={isSubmitting}>{isSubmitting ? 'Создаём…' : (isWimiRealOrderCreationEnabled() ? 'Создать заявку' : 'Создать демо-заказ')}</button>
                </div>
              </section>
            )}
          </>
        )}
        <footer className="wimi-footer">{isWimiRealOrderCreationEnabled() ? 'WIMI KIDS · Серверное создание включено для контролируемого теста' : 'WIMI KIDS · Прототип пользовательского сценария · Реальные заказы отключены'}</footer>
      </main>
    </div>
  )
}

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="wimi-summary-row"><span>{label}</span><strong>{value}</strong></div>
)

const WimiRouteFallback = () => (
  <section className="wimi-card">
    <h1>Страница не найдена</h1>
    <p className="wimi-muted">Откройте форму заказа, чтобы продолжить.</p>
    <Link className="wimi-button wimi-button-primary" to="/">Перейти к заказу</Link>
  </section>
)

export default function WimiRoot() {
  return <Routes><Route path="/*" element={<WimiApp />} /><Route path="*" element={<WimiRouteFallback />} /></Routes>
}
