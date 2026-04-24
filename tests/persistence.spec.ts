import { test, expect } from '@playwright/test';

const HOMESERVER = 'https://longestyeahboiever.space';
const USERNAME = 'durkluf';
const PASSWORD = 'WUshD@Zx8T*JxntHAzZN';
const RECOVERY_KEY = 'EsTx sry1 YDzP bbqG DXSj zCNf XhTC S74Y yZcv WnYG 5tLB 6jVE';

test.describe('E2EE Persistence', () => {
  test('should persist trust after page reload', async ({ page }) => {
    test.setTimeout(180000);

    console.log('Step 1: Fresh Login');
    await page.goto('http://localhost:5173/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.getByPlaceholder(/homeserver/i).fill(HOMESERVER);
    await page.getByPlaceholder(/username/i).fill(USERNAME);
    await page.getByPlaceholder(/password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    console.log('Step 2: Enter Recovery Key');
    const recoveryInput = page.getByPlaceholder(/recovery key/i);
    await recoveryInput.waitFor({ state: 'visible', timeout: 60000 });
    await recoveryInput.fill(RECOVERY_KEY);
    await page.getByRole('button', { name: /confirm identity/i }).click();
    await expect(recoveryInput).toBeHidden({ timeout: 30000 });

    console.log('Step 3: Verify initial trust');
    await page.locator('button:has(.lucide-settings)').first().click({ force: true });
    const modal = page.locator('#settings-modal-overlay');
    await expect(modal.getByText('Restored')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'trust-initial.png' });

    console.log('Step 4: Reload page and verify persistence');
    await page.reload();
    // App should auto-sync and not show recovery modal
    await expect(page.getByRole('button', { name: /direct messages/i })).toBeVisible({ timeout: 60000 });
    await expect(page.getByPlaceholder(/recovery key/i)).not.toBeVisible();

    await page.locator('button:has(.lucide-settings)').first().click({ force: true });
    // Should STILL be restored without entering the key again
    await expect(modal.getByText('Restored')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'trust-after-reload.png' });

    console.log('Verification successful: Trust persisted.');
  });
});
