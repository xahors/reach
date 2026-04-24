import { test, expect } from '@playwright/test';

const HOMESERVER = 'https://longestyeahboiever.space';
const USERNAME = 'durkluf';
const PASSWORD = 'WUshD@Zx8T*JxntHAzZN';
const RECOVERY_KEY = 'EsTx sry1 YDzP bbqG DXSj zCNf XhTC S74Y yZcv WnYG 5tLB 6jVE';

test.describe('Fast Verification', () => {
  test('should verify account and e2ee status with minimal waiting', async ({ page }) => {
    test.setTimeout(90000);

    console.log('Navigating to app...');
    await page.goto('http://localhost:5173/');

    // Login (we still login to get a fresh token, but we'll optimize the wait)
    await page.getByPlaceholder(/homeserver/i).fill(HOMESERVER);
    await page.getByPlaceholder(/username/i).fill(USERNAME);
    await page.getByPlaceholder(/password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Fast wait for recovery or app
    const recoveryInput = page.getByPlaceholder(/recovery key/i);
    await recoveryInput.waitFor({ state: 'visible', timeout: 30000 });
    
    console.log('Entering recovery key...');
    await recoveryInput.fill(RECOVERY_KEY);
    await page.getByRole('button', { name: /confirm identity/i }).click();

    // Immediately check if Account tab loads correctly
    console.log('Opening settings...');
    // Don't wait for full sync, just try to open settings as soon as possible
    await page.locator('button:has(.lucide-settings)').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('button:has(.lucide-settings)').first().click({ force: true });
    
    const modal = page.locator('#settings-modal-overlay');
    await expect(modal).toBeVisible();
    
    console.log('Checking Account and E2EE indicators...');
    await expect(modal.getByRole('heading', { name: /^account$/i })).toBeVisible();
    
    // Check for the new E2EE status section
    await expect(modal.getByText('Encryption & Security')).toBeVisible();
    
    // Log the actual status seen on screen
    const verifiedStatus = await modal.getByText(/Session Verification/i).locator('..').locator('..').innerText();
    const keysStatus = await modal.getByText(/Cross-Signing Keys/i).locator('..').locator('..').innerText();
    const backupStatus = await modal.getByText(/Message Backup/i).locator('..').locator('..').innerText();
    
    console.log('--- E2EE STATUS ON SCREEN ---');
    console.log(verifiedStatus.replace(/\n/g, ' | '));
    console.log(keysStatus.replace(/\n/g, ' | '));
    console.log(backupStatus.replace(/\n/g, ' | '));
    console.log('----------------------------');

    await page.screenshot({ path: 'fast-verification.png' });
  });
});
