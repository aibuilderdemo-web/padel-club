import { test } from '@playwright/test';
import { accounts, logIn, missingEnv } from './helpers';

test.skip(
  !!missingEnv('MEMBER_EMAIL', 'MEMBER_PASSWORD', 'STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'NEXT_PUBLIC_SITE_URL'),
  'needs the member account and the Stripe keys',
);

test('becoming a member reaches the Stripe checkout page', async ({ page }) => {
  const { member } = accounts();
  await logIn(page, member.email, member.password);
  await page.goto('/membership');
  await page.getByRole('button', { name: 'Become a member' }).click();
  await page.waitForURL(/checkout\.stripe\.com/);
});
