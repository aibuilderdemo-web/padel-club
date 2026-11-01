import { test, expect } from '@playwright/test';
import { accounts, logIn, missingEnv } from './helpers';

test.skip(!!missingEnv('MEMBER_EMAIL', 'MEMBER_PASSWORD'), 'needs the member account');

test('a member logs in and sees their bookings', async ({ page }) => {
  const { member } = accounts();
  await logIn(page, member.email, member.password);
  await page.getByRole('link', { name: 'My bookings' }).click();
  await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible();
  await expect(page.locator('p[role=alert]')).toHaveCount(0);
});
