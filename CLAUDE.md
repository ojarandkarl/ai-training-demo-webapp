# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

"Õnnepood" is a synthetic Express e-commerce demo, used as material for AI-assisted software quality training. All products, users and orders are fake. Several defects and flaky tests are **deliberate exercise material**, so do not "fix" them unless the task explicitly asks for it (see "Intentional defects" below). Do not add real client data or credentials.

Exercise instructions live in `demo-scenarios/` and are written in Estonian. Session 5 (`demo-scenarios/session-5-agendid/`) is the agent/test-automation session, and its prompts are in `PROMPTID.md`. Product names, UI text and `edw` script output are in Estonian. Code identifiers and test names are in English.

## Commands

No build or lint step. Requires Node 22.5+ (`scripts/edw.js` uses the built-in `node:sqlite`).

```bash
npm install
npm start                      # http://localhost:3000 (PORT env overrides)
npm run test:stable            # stable unit tests, the "setup is OK" check
npm test                       # jest default: also includes tests/checkoutFlow.test.js (intentionally flaky)
npx jest tests/orderService.test.js --watchman=false          # single file
npx jest tests/orderService.test.js -t "part of test name" --watchman=false   # single test
npm run test:flaky             # tests/flaky once, random order
npm run test:repeat -- 10      # tests/flaky N times + per-test failure tally
npm run test:ui                # Selenium tests in tests/ui/ (participants write these)
npm run test:api -- automation/api/<collection>.json   # Newman / Postman collection
npm run edw:build              # build edw/edw.db from staging.sql + transform.sql
npm run edw:sql -- "SELECT ..."   # one query (or a path to a .sql file)
npm run edw:test               # run edw/tests/*.sql (a test passes when it returns 0 rows)
npm run edw:test -- --rikutud  # same tests on deliberately broken data; good tests must fail here
```

Always pass `--watchman=false` to jest directly (all npm scripts already do). Jest's `testPathIgnorePatterns` in `package.json` excludes `tests/flaky/` and `tests/ui/`. `test:stable` additionally excludes `checkoutFlow.test.js`.

## Architecture

- `src/server.js` only listens. `src/app.js` exports `createApp(options)`, which wires the routes (`GET /api/products`, `GET /api/products/:id`, `POST /api/orders`) and accepts injected `productRepository` / `orderService`. Tests use supertest against `createApp` with jest mocks instead of starting a server. Any unhandled error becomes `500 {"error":"Unexpected demo shop error"}`.
- `src/db/ProductRepository.js`: the catalog is a hard-coded array behind a fake "db" (`createMemoryDb`). That fake db dispatches on **substrings of the SQL text** (`'order by name'`, `'where id = ?'`). Changing the SQL strings silently breaks lookups.
- `src/services/OrderService.js`: `createOrderService(api)` contains the validation, total and payload logic. The default `api` is an in-file fake backend.
- `src/public/`: static vanilla-JS frontend (`index.html`, `site.js`, `styles.css`).
- `src/services/CheckoutSimulator.js`: a fake "page object" used only by the flaky checkout test.
- `src/booking/`: Session 5 module. `priceCalculator.js` (all money in cents, `YYYY-MM-DD` dates in UTC) implements the business rules in `demo-scenarios/session-4-restful-booker/1_Broneeringu_nouded_mustand.md`, which is the source of truth for expected results. `bookingStore.js` keeps module-level in-memory state with random write delays.
- `edw/`: SQLite mini data warehouse. `staging.sql` → `transform.sql` produces `dim_room`, `fact_booking` and `reject_booking`. `LDM.md` documents the model. `rikutud_andmed.sql` is the sabotage data.
- Empty placeholder dirs for participant work: `tests/ui/`, `automation/api/`, `edw/tests/`. `.github/copilot-instructions.md` is intentionally absent because participants create it in an exercise.

## Intentional defects (exercise material)

- **Order bug:** for product `backorder-01`, the fake API returns `{statusCode: 202, accepted: true}` with no `data`. `submitOrder` then reads `response.data.status`, which throws, and the user gets a 500. Copies are also in `demo-scenarios/order-service-bug/`.
- **Flaky checkout test:** `CheckoutSimulator.clickConfirmOrder` sets the confirmation after a random 180–330 ms without awaiting it, while `tests/checkoutFlow.test.js` waits a fixed 300 ms.
- **`tests/flaky/bookingFlaky.test.js` (F1–F4):** these fail because of races and timing in the code (concurrent `createBooking`, shared module state across tests, wall-clock time around the 48 h cancellation boundary, random stay length versus the 14-night limit).

## Testide stiil

- Fail `tests/<moodul>.test.js`, üks `describe` mooduli nimega: `describe('OrderService', ...)`, `describe('createApp', ...)`.
- Testi nimi on inglise keeles, kujul „funktsioon või route + oodatav käitumine“: `'validateCart reports missing items'`, `'GET /api/products/:id returns 404 when missing'`.
- Iga test loob oma instantsi fabrikuga (`const service = createOrderService();`). `beforeEach`-i ei kasutata. Jagatakse ainult muutumatuid fikstuure `describe` alguses (`cart`, `paymentInfo`).
- Sõltuvused süstitakse fabrikusse ja mockitakse: `createApp({ orderService: { submitOrder: jest.fn().mockResolvedValue({ success: false }) } })`.
- Testandmed on väljamõeldud ja kirjutatud otse testi, summad sentides: `userId: 'user-123'`, `token: 'tok_synthetic'`, `priceCents: 4990`.
- HTTP-testid jooksevad supertestiga otse `createApp()` vastu, ilma serverita: `await request(app).get('/api/products/missing').expect(404).expect({ error: 'Product not found' })`.
- Kontrollid: `toEqual` kogu objekti või massiivi kohta, `toBe` primitiivide kohta, `toThrow('Order is not ready to submit')` täpse teatega.
- Async-kontroll käib kujul `await expect(service.getOrderStatus('ord_123')).resolves.toBe('confirmed')`.
- Muutuvaid väärtusi kontrollitakse mustriga, näiteks `reference: expect.stringMatching(/^ord_\d{8}_user12$/)`. Teine võimalus on aeg ette anda: `createOrderReference('User-123', new Date('2026-09-07T08:00:00Z'))`.
- Mocki kutset kontrollitakse täpsete argumentidega: `expect(db.get).toHaveBeenCalledWith('select ... where id = ?', ['keyboard-01'])`.
- Ajastus: kasutatakse `jest.useFakeTimers()` + `jest.advanceTimersByTime(50)` või nullilähedast viivitust (`createCheckoutSimulator({ baseRenderDelayMs: 1, jitterMs: 1 })`).
- Välditakse fikseeritud ootamist juhusliku viivituse peale, näiteks `await sleep(300)` failis `checkoutFlow.test.js`, mis on meelega flaky.

## Testimise reeglid

1. Testid on Jestis, failid kaustas tests/, nimi <moodul>.test.js. SQL-testid on kaustas edw/tests/.
2. Rahasummad on sentides (täisarvud), kuupäevad YYYY-MM-DD UTC-s.
3. Äriloogika on failides demo-scenarios/session-4-restful-booker/1_Broneeringu_nouded_mustand.md
   ja edw/LDM.md. Testi oodatav tulemus tuleb nõudest, mitte koodist.
4. Kui test kukub, ära muuda oodatavat tulemust ilma minult küsimata.
