// UI tests for demo-scenarios/session-4-restful-booker/7_Brauseri_stsenaariumid.md (S1-S3).
// Runs against the public demo https://automationintesting.online, so bookings are real records there.
// Run: npm run test:ui   (set HEADED=1 to watch the browser)
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const BASE_URL = 'https://automationintesting.online';
const TEST_TIMEOUT_MS = 90000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const guest = {
  firstname: 'Test',
  lastname: 'Koolitus',
  email: 'test@example.com',
  phone: '+37255500000'
};

function createDriver() {
  const options = new chrome.Options().addArguments('--window-size=1280,1000');
  if (!process.env.HEADED) {
    options.addArguments('--headless=new');
  }
  return new Builder().forBrowser('chrome').setChromeOptions(options).build();
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

// Random 2-night stay at least 3 months ahead. Check-in is never a Saturday or one of the last
// days of the month, so both selected calendar cells sit in the same week row and month view.
function randomStay() {
  for (;;) {
    const daysAhead = 95 + Math.floor(Math.random() * 120);
    const checkin = new Date(Date.UTC(
      new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + daysAhead
    ));
    if (checkin.getUTCDay() !== 6 && checkin.getUTCDate() <= 26) {
      const lastNight = new Date(checkin.getTime() + MS_PER_DAY);
      const checkout = new Date(checkin.getTime() + 2 * MS_PER_DAY);
      return { checkin, lastNight, checkout };
    }
  }
}

async function scrollIntoView(driver, element) {
  await driver.executeScript('arguments[0].scrollIntoView({block: "center", behavior: "instant"})', element);
}

async function clickVisible(driver, locator) {
  const element = await driver.wait(until.elementLocated(locator), 15000);
  await scrollIntoView(driver, element);
  await driver.wait(until.elementIsVisible(element), 5000);
  await element.click();
}

async function bodyText(driver) {
  return driver.findElement(By.css('body')).getText();
}

// S1 steps 1-3: home page -> first room "Book now" -> select dates in the calendar -> "Reserve Now".
async function openReservationForm(driver, stay) {
  await driver.get(BASE_URL);
  const bookNow = await driver.wait(
    until.elementLocated(By.xpath("(//a[normalize-space()='Book now'])[1]")), 15000
  );
  await scrollIntoView(driver, bookNow);
  await bookNow.click();
  await driver.wait(until.elementLocated(By.css('.rbc-calendar')), 15000);

  const today = new Date();
  const monthsAhead = (stay.checkin.getUTCFullYear() - today.getUTCFullYear()) * 12
    + stay.checkin.getUTCMonth() - today.getUTCMonth();
  for (let i = 0; i < monthsAhead; i += 1) {
    await clickVisible(driver, By.xpath("//div[contains(@class,'rbc-toolbar')]//button[normalize-space()='Next']"));
  }

  const firstCell = await findDayCell(driver, stay.checkin.getUTCDate());
  const lastCell = await findDayCell(driver, stay.lastNight.getUTCDate());
  await scrollIntoView(driver, firstCell);
  // react-big-calendar only starts a selection after a slow, real mouse drag.
  await driver.actions()
    .move({ origin: firstCell }).pause(100).press().pause(150)
    .move({ origin: firstCell, x: 10, y: 0, duration: 150 }).pause(150)
    .move({ origin: lastCell, duration: 300 }).pause(150)
    .release()
    .perform();

  await clickVisible(driver, By.xpath("//button[normalize-space()='Reserve Now']"));
  await driver.wait(until.elementLocated(By.css('input[placeholder="Firstname"]')), 10000);
}

async function findDayCell(driver, dayOfMonth) {
  const label = String(dayOfMonth).padStart(2, '0');
  const rows = await driver.findElements(By.css('.rbc-month-row'));
  for (const row of rows) {
    const dates = await row.findElements(By.css('.rbc-date-cell'));
    for (let i = 0; i < dates.length; i += 1) {
      const isCurrentMonth = !(await dates[i].getAttribute('class')).includes('rbc-off-range');
      if (isCurrentMonth && (await dates[i].getText()).trim() === label) {
        return (await row.findElements(By.css('.rbc-day-bg')))[i];
      }
    }
  }
  throw new Error(`Calendar day ${label} not found`);
}

async function fillGuestForm(driver, values) {
  for (const [placeholder, value] of Object.entries(values)) {
    const input = await driver.findElement(By.css(`input[placeholder="${placeholder}"]`));
    await input.clear();
    if (value) {
      await input.sendKeys(value);
    }
  }
}

describe('Reservation UI', () => {
  test('S1 booking with valid data shows Booking Confirmed and the selected dates', async () => {
    const driver = await createDriver();
    try {
      const stay = randomStay();
      await openReservationForm(driver, stay);
      await fillGuestForm(driver, {
        Firstname: guest.firstname,
        Lastname: guest.lastname,
        Email: guest.email,
        Phone: guest.phone
      });
      await clickVisible(driver, By.xpath("//button[normalize-space()='Reserve Now']"));

      await driver.wait(async () => (await bodyText(driver)).includes('Booking Confirmed'), 15000)
        .catch(() => {});
      const text = await bodyText(driver);
      expect(text).toContain('Booking Confirmed');
      expect(text).toContain(toIsoDate(stay.checkin));
      expect(text).toContain(toIsoDate(stay.checkout));
    } finally {
      await driver.quit();
    }
  }, TEST_TIMEOUT_MS);

  test('S2 empty Firstname is not confirmed and the error names the missing field', async () => {
    const driver = await createDriver();
    try {
      await openReservationForm(driver, randomStay());
      await fillGuestForm(driver, {
        Firstname: '',
        Lastname: guest.lastname,
        Email: guest.email,
        Phone: guest.phone
      });
      await clickVisible(driver, By.xpath("//button[normalize-space()='Reserve Now']"));

      await driver.wait(until.elementLocated(By.css('.alert')), 10000).catch(() => {});
      const text = await bodyText(driver);
      expect(text).not.toContain('Booking Confirmed');
      expect(text).toMatch(/first\s?name/i);
    } finally {
      await driver.quit();
    }
  }, TEST_TIMEOUT_MS);

  test('S3 checkout before checkin shows no negative nights or price in the summary', async () => {
    const driver = await createDriver();
    try {
      await driver.get(`${BASE_URL}/reservation/1?checkin=2026-12-12&checkout=2026-12-10`);
      const summary = await driver.wait(
        until.elementLocated(By.xpath("//*[normalize-space()='Price Summary']/..")), 15000
      );
      await scrollIntoView(driver, summary);
      const text = await summary.getText();

      expect(text).not.toMatch(/x\s*-\d+\s*nights?/);
      expect(text).not.toMatch(/-\s*£\s*\d|£\s*-\d/);
    } finally {
      await driver.quit();
    }
  }, TEST_TIMEOUT_MS);
});
