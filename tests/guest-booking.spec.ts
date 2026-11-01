import { test, expect } from '@playwright/test';
import { LAST_GUEST_DAY, cancelWithCode, submitBooking } from './helpers';

test('a guest books a free slot on the last bookable day', async ({ page }) => {
  const date = LAST_GUEST_DAY();
  await page.goto(`/?date=${date}`);

  // Take the last free slot of Court 1: always in the future, rarely taken by other runs.
  const court1 = page.locator('section').filter({ hasText: 'Court 1' }).first();
  const slot = court1.getByRole('link').last();
  const time = (await slot.textContent())!.trim();
  await slot.click();

  await submitBooking(page, 'Giulia Test', '333 000 0099');

  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();
  const code = (await page.locator('strong.font-mono').textContent())!.trim();

  // The slot is no longer offered on that court.
  await page.goto(`/?date=${date}`);
  await expect(court1.getByRole('link', { name: time, exact: true })).toHaveCount(0);

  // Free the slot again so the next run finds it.
  await cancelWithCode(page, code);
});
