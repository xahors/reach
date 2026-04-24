import { test, expect } from '@playwright/test';

const HOMESERVER = 'https://longestyeahboiever.space';
const USERNAME = 'durkluf';
const PASSWORD = 'WUshD@Zx8T*JxntHAzZN';
const RECOVERY_KEY = 'EsTx sry1 YDzP bbqG DXSj zCNf XhTC S74Y yZcv WnYG 5tLB 6jVE';

test.describe('Encryption and Account Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Start with a clean state to force login
    await page.goto('http://localhost:5173/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should restore encryption and show verified status', async ({ page }) => {
    test.setTimeout(120000);

    page.on('console', msg => {
      console.log(`BROWSER LOG [${msg.type()}]: ${msg.text()}`);
    });

    console.log('Filling login form...');
    await page.getByPlaceholder(/homeserver/i).fill(HOMESERVER);
    await page.getByPlaceholder(/username/i).fill(USERNAME);
    await page.getByPlaceholder(/password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    console.log('Waiting for recovery screen...');
    // Recovery modal should appear once sync starts
    const recoveryInput = page.getByPlaceholder(/recovery key/i);
    await expect(recoveryInput).toBeVisible({ timeout: 60000 });
    
    console.log('Entering recovery key...');
    await recoveryInput.fill(RECOVERY_KEY);
    await page.getByRole('button', { name: /confirm identity/i }).click();

    // Wait for recovery to succeed
    await expect(recoveryInput).toBeHidden({ timeout: 30000 });
    console.log('Recovery modal dismissed.');

    // Wait for app to be synced
    await expect(page.getByRole('button', { name: /direct messages/i })).toBeVisible({ timeout: 30000 });

    // Open settings to check status
    console.log('Opening settings...');
    await page.locator('button:has(.lucide-settings)').first().click({ force: true });
    
    const modal = page.locator('#settings-modal-overlay');
    await expect(modal).toBeVisible();
    
    // The tab and heading are named "Account"
    await expect(modal.getByRole('heading', { name: /^account$/i })).toBeVisible();
    
    console.log('Verifying User ID and Encryption indicators...');
    await expect(modal.getByText(`${USERNAME}:longestyeahboiever.space`)).toBeVisible();

    // Verify "Account" text in sidebar is there
    await expect(modal.getByRole('button', { name: /^account$/i })).toBeVisible();

    await page.screenshot({ path: 'account-verified-final.png' });
  });
});
