import { test, expect } from '@playwright/test';

const HOMESERVER = 'https://longestyeahboiever.space';
const USERNAME = 'durkluf';
const PASSWORD = 'WUshD@Zx8T*JxntHAzZN';
const RECOVERY_KEY = 'EsTx sry1 YDzP bbqG DXSj zCNf XhTC S74Y yZcv WnYG 5tLB 6jVE';

test.describe('Account Settings Verification', () => {
  test('should login and navigate to account settings without crashing', async ({ page }) => {
    test.setTimeout(120000);

    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`BROWSER ERROR: ${msg.text()}`);
    });

    console.log('Navigating to app...');
    await page.goto('http://localhost:5173/');

    console.log('Filling login form...');
    await page.getByPlaceholder('https://matrix.org').fill(HOMESERVER);
    await page.getByPlaceholder('user').fill(USERNAME);
    await page.getByPlaceholder('••••••••').fill(PASSWORD);
    
    console.log('Clicking Sign In...');
    await page.getByRole('button', { name: /sign in/i }).click();

    console.log('Waiting for recovery screen or app load...');
    const recoveryInput = page.getByPlaceholder(/security key/i);
    const appLoadedMarker = page.getByRole('button', { name: /direct messages/i });
    
    await Promise.race([
      recoveryInput.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {}),
      appLoadedMarker.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {})
    ]);

    if (await recoveryInput.isVisible()) {
      console.log('Recovery screen detected, entering key...');
      await recoveryInput.fill(RECOVERY_KEY);
      await page.getByRole('button', { name: /restore history/i }).click();
      await expect(appLoadedMarker).toBeVisible({ timeout: 30000 });
    }

    console.log('App loaded. Opening settings...');
    // The settings icon is in the footer
    const settingsButton = page.locator('button:has(.lucide-settings)').first();
    await settingsButton.click({ force: true });
    
    console.log('Waiting for settings modal...');
    const modal = page.locator('#settings-modal-overlay');
    await expect(modal).toBeVisible({ timeout: 15000 });
    
    console.log('Modal is visible. Verifying Account section...');
    // The tab is now named "Account"
    await expect(modal.getByRole('button', { name: /^account$/i })).toBeVisible();
    await expect(modal.getByRole('heading', { name: /^account$/i })).toBeVisible();
    
    console.log('Checking for User ID...');
    await expect(modal.getByText(`${USERNAME}:longestyeahboiever.space`, { exact: false })).toBeVisible({ timeout: 10000 });

    console.log('Verification successful.');
    await page.screenshot({ path: 'final-success.png' });
  });
});
