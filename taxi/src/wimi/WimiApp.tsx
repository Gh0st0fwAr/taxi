import React, { FormEvent, useRef, useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import {
  createDemoOrder,
  MINIMUM_DURATION_MINUTES,
  validateBookingDraft,
  WimiBookingDraft,
  WimiDemoOrder,
} from './mockAdapter'
import { getNannyPricingQuote } from './nannyPricingApi'
import WimiAddressPicker, { WimiSelectedAddress } from './WimiAddressPicker'

function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function money(cents: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'EUR' }).format(cents / 100)
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
  const [errors, setErrors] = useState<string[]>([])
  const [step, setStep] = useState<'details' | 'review' | 'created'>('details')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isQuoting, setIsQuoting] = useState(false)
  const [serverQuoteCents, setServerQuoteCents] = useState<number | null>(null)
  const submittingRef = useRef(false)
  const quoteRequestIdRef = useRef(0)
  const navigate = useNavigate()

  const update = <K extends keyof WimiBookingDraft>(key: K, value: WimiBookingDraft[K]) => {
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
      setErrors([message.includes('Unauthorized')
        ? 'Для запроса цены войдите в аккаунт WIMI KIDS на этой платформе.'
        : 'Не удалось получить цену с сервера. Заказ не создан. Проверьте соединение и попробуйте ещё раз.'])
    } finally {
      if (requestId === quoteRequestIdRef.current)
        setIsQuoting(false)
    }
  }

  const submitDemoOrder = () => {
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
      const created = createDemoOrder(draft, serverQuoteCents)
      setOrder(created)
      setErrors([])
      setStep('created')
      // Keep the guard locked until the user explicitly starts a new demo order.
    } catch {
      setErrors(['Не удалось создать демо-запись. Проверьте данные и попробуйте ещё раз.'])
      setStep('details')
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
          <strong>Демонстрационный режим</strong>
          <span>Реальный заказ не отправляется. Не вводите настоящие персональные данные.</span>
        </div>

        {step === 'created' && order ? (
          <section className="wimi-card wimi-result" aria-labelledby="created-title">
            <div className="wimi-success-icon" aria-hidden="true">✓</div>
            <p className="wimi-eyebrow">ДЕМО-ЗАКАЗ СОЗДАН ЛОКАЛЬНО</p>
            <h1 id="created-title">Проверка сценария завершена</h1>
            <p className="wimi-muted">Это тестовая запись только в памяти открытой страницы. Реальная заявка не отправлена, няня не назначена, уведомления не отправлены.</p>
            <div className="wimi-order-id">{order.id}</div>
            <div className="wimi-summary">
              <SummaryRow label="Адрес" value={order.address} />
              {typeof order.latitude === 'number' && typeof order.longitude === 'number' && (
                <SummaryRow label="Координаты" value={`${order.latitude.toFixed(5)}, ${order.longitude.toFixed(5)}`} />
              )}
              <SummaryRow label="Дата" value={order.date} />
              <SummaryRow label="Начало" value={order.startTime} />
              <SummaryRow label="Длительность" value={`${order.durationMinutes} минут`} />
              <SummaryRow label="Дети" value={String(order.childrenCount)} />
              <SummaryRow label="Возраст" value={order.childrenAges || 'Не указан'} />
              <SummaryRow label="Комментарий" value={order.notes || 'Нет'} />
              <SummaryRow label="Предварительная цена сервера" value={money(order.estimatedTotalCents)} />
            </div>
            <p className="wimi-disclaimer">Предварительная сумма получена с сервера. Это всё ещё демо-запись: реальный заказ не создан, а окончательная цена зависит от фактического времени. Данные не сохраняются после обновления или закрытия страницы.</p>
            <button type="button" className="wimi-button wimi-button-primary wimi-full" onClick={reset}>Создать ещё один демо-заказ</button>
          </section>
        ) : (
          <>
            <section className="wimi-intro">
              <p className="wimi-eyebrow">WIMI KIDS · СЕРВИС ВЫЗОВА НЯНЬ</p>
              <h1>{step === 'review' ? 'Проверьте детали заказа' : 'Найдём время для заботы'}</h1>
              <p className="wimi-muted">{step === 'review' ? 'Перед созданием демо-заказа проверьте адрес, время и предварительную сумму.' : 'Укажите основные детали — перед проверкой веб-версия запросит цену у сервера.'}</p>
            </section>

            <div className="wimi-steps" aria-label="Этапы заказа">
              <div className={step === 'details' ? 'wimi-step is-active' : 'wimi-step is-done'}><span>1</span><div><strong>Детали</strong><small>Услуга и время</small></div></div>
              <div className={step === 'review' ? 'wimi-step is-active' : 'wimi-step'}><span>2</span><div><strong>Проверка</strong><small>Сумма и данные</small></div></div>
              <div className="wimi-step"><span>3</span><div><strong>Готово</strong><small>Демо-результат</small></div></div>
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
                  <input id="wimi-duration" type="number" min={MINIMUM_DURATION_MINUTES} max="1080" step="1" value={draft.durationMinutes} onChange={event => update('durationMinutes', event.target.value === '' ? Number.NaN : Number(event.target.value))} required />
                  <small>Минимум 120 минут. Заказ должен завершиться не позднее 00:00.</small>
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
                <p className="wimi-disclaimer">Цена получена через nanny_pricing. Создание заказа пока остаётся демо: для реального create нужно подтвердить координаты адреса и точное соответствие полей backend DTO.</p>
                <div className="wimi-actions">
                  <button type="button" className="wimi-button wimi-button-secondary" onClick={() => { setErrors([]); setStep('details') }}>Назад к данным</button>
                  <button type="button" className="wimi-button wimi-button-primary" onClick={submitDemoOrder} disabled={isSubmitting}>{isSubmitting ? 'Создаём…' : 'Создать демо-заказ'}</button>
                </div>
              </section>
            )}
          </>
        )}
        <footer className="wimi-footer">WIMI KIDS · Прототип пользовательского сценария · Реальные заказы отключены</footer>
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
