import { test, expect, devices, type Browser, type BrowserContextOptions } from '@playwright/test';
import { logIn, milanDate, submitBooking } from './helpers';

// Simulates 200 visitors on the PREVIEW deployment. Run it with:
//   PREVIEW_URL=<preview> npx playwright test traffic.spec.ts
//
// Visitors   1-60  : guest, complete a booking
// Visitors  61-100 : log in as test01..test40, click "Become a member" (checkout started)
// Visitors  61-72  : also pay on Stripe Checkout with the 4242 test card (paid)
// Visitors 101-200 : only look at the free slots
// Every visitor opens /book, picks tomorrow and opens a free slot first.

const VISITORS = 200;
const GUESTS = 60;
const MEMBERS_FIRST = 61;
const MEMBERS_LAST = 100;
const PAYERS_LAST = 72;
const PARALLEL = 10;

// PostHog drops bots: a user agent or a browser brand saying "HeadlessChrome", or navigator.webdriver set.
// So: real device profiles, the full Chromium build (the default headless shell reports the
// HeadlessChrome brand) and navigator.webdriver off in every visitor (see visit()).
test.use({ channel: 'chromium' });
const PHONES = ['iPhone 13', 'Pixel 7'];
const DESKTOPS = ['Desktop Chrome', 'Desktop Edge'];

function previewUrl(): string {
  const raw = process.env.PREVIEW_URL;
  if (!raw) throw new Error('PREVIEW_URL is not set. Point it at the Vercel preview deployment.');
  const url = new URL(raw);
  const host = url.hostname;

  // Never the live domain. We do not know it, so be strict: only *.vercel.app preview hosts
  // (or localhost), and never the host the app itself calls its site, or LIVE_URL if given.
  const live = [process.env.NEXT_PUBLIC_SITE_URL, process.env.LIVE_URL]
    .filter((v): v is string => !!v)
    .map((v) => new URL(v).hostname)
    .filter((h) => h !== 'localhost');
  if (live.includes(host)) throw new Error(`Refusing to run against the live domain (${host}).`);
  if (!host.endsWith('.vercel.app') && host !== 'localhost') {
    throw new Error(`Refusing to run: ${host} is not a *.vercel.app preview URL.`);
  }
  return url.origin;
}

function contextFor(n: number): BrowserContextOptions {
  const name = (n % 2 ? PHONES : DESKTOPS)[Math.floor(n / 2) % 2];
  // defaultBrowserType is not a context option; all visitors run in the installed Chromium.
  const { defaultBrowserType: _ignored, ...profile } = devices[name];
  return profile;
}

function memberLogin(n: number) {
  const nn = String(n - GUESTS).padStart(2, '0'); // visitor 61 -> test01
  const domain = process.env.TEST_EMAIL_DOMAIN;
  const email = process.env[`TEST${nn}_EMAIL`] ?? (domain ? `test${nn}@${domain}` : '');
  const password = process.env[`TEST${nn}_PASSWORD`] ?? process.env.TEST_MEMBER_PASSWORD ?? '';
  if (!email || !password) {
    throw new Error(`No login for test${nn}: set TEST${nn}_EMAIL/TEST${nn}_PASSWORD (or TEST_EMAIL_DOMAIN and TEST_MEMBER_PASSWORD) in .env.test.`);
  }
  return { email, password };
}

// Next.js puts a role="alert" route announcer on every page, which reads the page title after each
// navigation: only the app's own alerts count.
const alert = (page: import('@playwright/test').Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

type Result = { viewed: boolean; booked: boolean; startedCheckout: boolean; paid: boolean };

async function visit(browser: Browser, baseURL: string, n: number): Promise<Result> {
  const result: Result = { viewed: false, booked: false, startedCheckout: false, paid: false };
  const context = await browser.newContext({ ...contextFor(n), baseURL });
  // Without this a click on a missing element waits until the whole run times out.
  context.setDefaultTimeout(30_000);
  await context.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  try {
    const page = await context.newPage();

    // The user agent must not look like a bot.
    const ua = await page.evaluate(() => navigator.userAgent);
    expect(ua, `visitor ${n} user agent`).not.toMatch(/headless/i);

    // Everyone: open /book, pick tomorrow and open a free slot (that sends slot_viewed).
    await page.goto('/book');
    await page.getByRole('button', { name: 'Tomorrow' }).click();
    const slots = page.locator('a[href^="/book?court="]');
    await expect(slots.first()).toBeVisible();

    const book = page.getByRole('button', { name: 'Book' });
    if (n <= GUESTS) {
      // A day has 32 slots: guests 1-30 book tomorrow, 31-60 the day after (guests can book 2 days ahead).
      // Each one takes a random free slot; if another visitor got it first, it tries another one.
      const date = milanDate(n <= GUESTS / 2 ? 1 : 2);
      for (let attempt = 0; attempt < 8 && !result.booked; attempt++) {
        const { slots: free = [] } = await (await page.request.get(`/api/slots?date=${date}`, { timeout: 60_000 })).json();
        if (!free.length) throw new Error(`no free slots on ${date}`);
        const slot = free[Math.floor(Math.random() * free.length)];
        await page.goto(`/book?court=${slot.courtId}&date=${date}&time=${slot.time}`);
        await expect(book).toBeVisible();
        result.viewed = true;
        await submitBooking(page, `Traffic Guest ${n}`, `333 ${String(n).padStart(7, '0')}`);
        const confirmed = page.getByRole('heading', { name: 'Booking confirmed' });
        await expect(confirmed.or(alert(page))).toBeVisible({ timeout: 20_000 });
        result.booked = await confirmed.isVisible();
      }
      if (!result.booked) console.log(`visitor ${n} not booked: ${await alert(page).first().innerText().catch(() => '?')}`);
    } else {
      await slots.nth(n % (await slots.count())).click();
      await expect(book).toBeVisible();
      result.viewed = true;
    }

    if (n >= MEMBERS_FIRST && n <= MEMBERS_LAST) {
      const { email, password } = memberLogin(n);
      await logIn(page, email, password);
      await page.goto('/membership');
      await page.getByRole('button', { name: 'Become a member' }).click();
      await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
      result.startedCheckout = true;

      if (n <= PAYERS_LAST) {
        await payOnStripe(page);
        await page.waitForURL(/\/membership\/success/, { timeout: 120_000 });
        result.paid = true;
      }
    }
  } catch (e) {
    console.log(`visitor ${n} stopped: ${String(e).split('\n')[0]}`);
  } finally {
    // posthog-js sends its events in batches every few seconds: let the last batch go before closing.
    await context.pages()[0]?.waitForTimeout(4000).catch(() => {});
    await context.close();
  }
  return result;
}

// Stripe Checkout in test mode with the 4242 test card.
async function payOnStripe(page: import('@playwright/test').Page) {
  // Checkout lists card, Klarna and others in an accordion: open the card one first.
  // Wait for the page to load either way before choosing.
  const card = page.getByTestId('card-accordion-item');
  const number = page.locator('#cardNumber');
  await expect(card.or(number).first()).toBeVisible({ timeout: 30_000 });
  if (await card.isVisible()) await card.click();
  await number.fill('4242 4242 4242 4242');
  await page.locator('#cardExpiry').fill('12 / 34');
  await page.locator('#cardCvc').fill('123');
  const name = page.locator('#billingName');
  if (await name.count()) await name.fill('Traffic Member');
  const zip = page.locator('#billingPostalCode');
  if (await zip.isVisible().catch(() => false)) await zip.fill('20123');
  await page.getByTestId('hosted-payment-submit-button').click();
}

test('200 visitors on the preview deployment', async ({ browser }) => {
  test.setTimeout(60 * 60_000);
  const baseURL = previewUrl();
  console.log(`Simulating ${VISITORS} visitors on ${baseURL}`);

  // Fail early, before any traffic, if a member login is missing.
  for (let n = MEMBERS_FIRST; n <= MEMBERS_LAST; n++) memberLogin(n);

  const results: Result[] = new Array(VISITORS);
  let next = 1;
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      while (next <= VISITORS) {
        const n = next++;
        results[n - 1] = await visit(browser, baseURL, n);
      }
    }),
  );

  const total = (key: keyof Result) => results.filter((r) => r[key]).length;
  const viewed = total('viewed');
  const booked = total('booked');
  const started = total('startedCheckout');
  const paid = total('paid');
  console.log(`${viewed} viewed slots, ${booked} booked, ${started} started checkout, ${paid} paid`);

  expect({ viewed, booked, started, paid }).toEqual({
    viewed: VISITORS,
    booked: GUESTS,
    started: MEMBERS_LAST - MEMBERS_FIRST + 1,
    paid: PAYERS_LAST - MEMBERS_FIRST + 1,
  });
});
