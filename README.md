# FocusGroup Telegram Mini App (MVP)

Мини-приложение для Telegram WebApp в стиле "apple glass":
- запуск/остановка фокус-таймера (секундомер);
- выбор активности;
- статистика по периодам: сегодня / неделя / месяц / год / всё время;
- комнаты (много локальных соревнований), где у каждой комнаты свой лидерборд;
- нижняя навигация: Фокус / Музыка / Статистика / Профиль;
- переключение темы: светлая / тёмная.

## Быстрый старт

```bash
npm run dev
```

Открыть: `http://localhost:3000/?tgUserId=123&name=Alex`

## Как подключить к Telegram

1. Создайте Web App через BotFather.
2. Укажите URL вашего хостинга (`https://...`).
3. В Mini App можно читать `Telegram.WebApp.initDataUnsafe.user` (в коде уже предусмотрено).

## API (основное)

- `POST /api/users/upsert`
- `GET /api/activities?userId=...`
- `POST /api/activities`
- `GET /api/sessions/running?userId=...`
- `POST /api/sessions/start`
- `POST /api/sessions/stop`
- `GET /api/stats/summary?userId=...&period=today|week|month|year|all`
- `GET /api/stats/timeline?userId=...&period=...`
- `POST /api/rooms`
- `POST /api/rooms/:roomId/join`
- `GET /api/rooms?userId=...`
- `GET /api/rooms/:roomId/leaderboard?period=...`

## Ограничения MVP

- Простое хранение в JSON-файле (`data/store.json`) без БД.
- Нет валидации подписи Telegram initData (для production обязательно добавить).
- Раздел "Музыка" пока как UI-заглушка.
