import { test, expect } from '@playwright/test';
import { cancelWithCode, milanDate, missingEnv, submitBooking } from './helpers';

test.skip(!!missingEnv('SUPABASE_SECRET_KEY'), 'booking needs SUPABASE_SECRET_KEY');

test('the double booking is refused', async ({ page }) => {
  await page.goto(`/?date=${milanDate(1)}`);
  const court1 = page.locator('section').filter({ hasText: 'Court 1' }).first();
  const slot = court1.getByRole('link').last();
  const bookUrl = await slot.getAttribute('href');
  await slot.click();
  await submitBooking(page, 'Giulia Test', '333 000 0097');
  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();
  const code = (await page.locator('strong.font-mono').textContent())!.trim();

  // Same court, same time again: the database refuses it and the page shows why.
  await page.goto(bookUrl!);
  await submitBooking(page, 'Other Guest', '333 000 0096');
  await expect(page.locator('p[role=alert]')).toContainText('already booked');

  await cancelWithCode(page, code);
});
