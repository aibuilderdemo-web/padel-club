import { test, expect } from '@playwright/test';
import { accounts, logIn, missingEnv } from './helpers';

test('a member cannot open the staff page', async ({ page }) => {
  test.skip(!!missingEnv('MEMBER_EMAIL', 'MEMBER_PASSWORD'), 'needs the member account');
  const { member } = accounts();
  await logIn(page, member.email, member.password);
  await page.goto('/staff');
  await expect(page).not.toHaveURL(/\/staff/);
  await expect(page.getByRole('heading', { name: "Today's bookings" })).toHaveCount(0);
});

test('staff can open the staff page', async ({ page }) => {
  test.skip(!!missingEnv('STAFF_EMAIL', 'STAFF_PASSWORD'), 'needs the staff account');
  const { staff } = accounts();
  await logIn(page, staff.email, staff.password);
  await page.goto('/staff');
  await expect(page.getByRole('heading', { name: "Today's bookings" })).toBeVisible();
});
