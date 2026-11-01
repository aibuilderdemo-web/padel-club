import { expect, type Page } from '@playwright/test';

// Calendar date in Milan, `daysAhead` days from today, as YYYY-MM-DD.
export function milanDate(daysAhead = 0): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

// Last day a guest can book (the app allows 2 days ahead).
export const LAST_GUEST_DAY = () => milanDate(2);

export async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

// Fill and submit the booking form on /book.
export async function submitBooking(page: Page, name: string, phone: string) {
  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('textbox', { name: 'Phone' }).fill(phone);
  await page.getByRole('button', { name: 'Book' }).click();
}

// Server keys are not available in CI: tests that need them skip when they are missing.
export function missingEnv(...names: string[]): string | undefined {
  const missing = names.filter((n) => !process.env[n]);
  return missing.length ? `needs ${missing.join(', ')}` : undefined;
}

export function accounts() {
  const { MEMBER_EMAIL, MEMBER_PASSWORD, STAFF_EMAIL, STAFF_PASSWORD } = process.env;
  return {
    member: { email: MEMBER_EMAIL ?? '', password: MEMBER_PASSWORD ?? '' },
    staff: { email: STAFF_EMAIL ?? '', password: STAFF_PASSWORD ?? '' },
  };
}

// Cancel a guest booking with its code, so test runs do not use up the slots.
export async function cancelWithCode(page: Page, code: string) {
  await page.goto('/cancel');
  await page.getByLabel('Cancel code').fill(code);
  await page.getByRole('button', { name: 'Cancel booking' }).click();
}
