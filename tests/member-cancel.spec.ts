import { test, expect } from '@playwright/test';
import { accounts, logIn, milanDate, missingEnv, submitBooking } from './helpers';

test.skip(
  !!missingEnv('MEMBER_EMAIL', 'MEMBER_PASSWORD', 'SUPABASE_SECRET_KEY'),
  'needs the member account and SUPABASE_SECRET_KEY (booking is done on the server)',
);

test('a member cancels a booking', async ({ page }) => {
  const { member } = accounts();
  await logIn(page, member.email, member.password);

  // Book the last free slot of Court 2 tomorrow, so there is something to cancel.
  await page.goto(`/?date=${milanDate(1)}`);
  const court2 = page.locator('section').filter({ hasText: 'Court 2' }).first();
  const slot = court2.getByRole('link').last();
  const time = (await slot.textContent())!.trim();
  await slot.click();
  await submitBooking(page, 'Member Test', '333 000 0098');
  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();

  const cancellable = () =>
    page
      .getByRole('row')
      .filter({ hasText: 'Court 2' })
      .filter({ hasText: time })
      .filter({ has: page.getByRole('button', { name: 'Cancel' }) });

  await page.goto('/my-bookings');
  await cancellable().first().getByRole('button', { name: 'Cancel' }).click();

  // The app shows no message on success: the row says "Cancelled" instead.
  await expect(page.locator('p[role=alert]')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'Cancelled' }).first()).toBeVisible();
  // The booking is no longer in the list of bookings that can be cancelled.
  await expect(cancellable()).toHaveCount(0);
});
