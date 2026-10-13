# WIMI-008 — DTO создания заказа няни

Дата: 2026-10-13. Основание: MultiBot commit [`274cea96263d0b2d1baa442e76ff77ab1fb1772a`](https://github.com/BuevichRoman/MultiBot/commit/274cea96263d0b2d1baa442e76ff77ab1fb1772a), `src/newManagers/api/APIManager.ts` (`pricingTemplate`/`createDrive`) и `server/script_templates/nanny_pricing.php`.

## Реализовано в WIMI

- `taxi/src/wimi/nannyOrderPayload.ts` — типизированное преобразование формы в `action=create`, проверка координат, длительности, числа детей и `request_key`, разбор ответа с `data.b_id`.
- `taxi/src/wimi/nannyOrderApi.ts` — вызов `POST /script/template/nanny_pricing` через пользовательский `apiMethod`. Административные `token/hash` не добавляются в браузерный запрос. Feature flag `REACT_APP_WIMI_ENABLE_REAL_CREATE` по умолчанию выключен.
- `taxi/src/wimi/nannyOrderPayload.test.ts` — тесты DTO, смещения Europe/Madrid, UTC-времени окончания, ответа сервера, валидации и отсутствия поля «Куда».

## Mapping

| WIMI | Серверный DTO |
|---|---|
| Координаты выбранного места услуги | `order.b_start_latitude`, `order.b_start_longitude` |
| Дата/время начала Europe/Madrid | `order.b_start_datetime` с явным смещением |
| Длительность | `order.b_options.b_end_datetime` в UTC |
| Количество детей | `order.b_passengers_count`, `order.b_options.childrenProfiles` |
| Идемпотентный ключ | `request_key`; шаблон записывает его как `b_options.requestKey` |
| Ответ | `data.b_id`, `data.duplicate`, `data.pricingModel` |

DTO не содержит адреса назначения, координат назначения или `to`: пользователь указывает только одно место оказания услуги. Комментарий формы не отправляется, потому что проверенный код бота не подтверждает поле для него. `b_comments` передаётся пустым массивом, так как WIMI не выбирает Taxi `booking_comments`.

## Почему реальное создание пока выключено

1. В текущем `nanny_pricing.php` action `quote` задаёт `duration=0`, не учитывает `duration_min`, а `create` сохраняет результат этого расчёта. Это не подтверждает правильную сумму по длительности.
2. Код шаблона ищет предыдущий `request_key`, но не доказывает конфликт при повторе того же ключа с изменённым payload.
3. Нужна проверка успешного и ошибочного ответа на авторизованном тестовом пользователе в deployed окружении, включая таймаут после сохранения.
4. Feature flag не включать до исправления и тестирования серверных блокеров, проверки DST/тарифа/идемпотентности и Taxi regression.

**Состояние:** DTO и API-клиент добавлены в ветку `feat/wimi-nanny-order-create-validation`. UI остаётся в демо-режиме; реальные заказы не отправляются.