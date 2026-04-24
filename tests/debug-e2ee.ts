import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type()}] ${msg.text()}`);
  });

  try {
    console.log('Navigating to http://localhost:5173/...');
    await page.goto('http://localhost:5173/');

    console.log('Logging in...');
    await page.getByPlaceholder(/homeserver/i).fill('https://longestyeahboiever.space');
    await page.getByPlaceholder(/username/i).fill('durkluf');
    await page.getByPlaceholder(/password/i).fill('WUshD@Zx8T*JxntHAzZN');
    await page.getByRole('button', { name: /sign in/i }).click();

    console.log('Waiting for recovery screen...');
    const recoveryInput = page.getByPlaceholder(/recovery key/i);
    await recoveryInput.waitFor({ state: 'visible', timeout: 60000 });
    
    console.log('Entering recovery key...');
    await recoveryInput.fill('EsTx sry1 YDzP bbqG DXSj zCNf XhTC S74Y yZcv WnYG 5tLB 6jVE');
    await page.getByRole('button', { name: /confirm identity/i }).click();

    console.log('Waiting for app to load...');
    await page.getByRole('button', { name: /direct messages/i }).waitFor({ state: 'visible', timeout: 60000 });

    console.log('Opening #client_debugging...');
    // Find the room and click it
    const debuggingRoom = page.getByText('#client_debugging').first();
    await debuggingRoom.click({ force: true });

    console.log('Waiting for messages to load and potential decryption errors...');
    await page.waitForTimeout(15000); // Wait for sync and gossip

    console.log('Inspecting MatrixClient crypto state...');
    const cryptoState = await page.evaluate(async () => {
      // @ts-expect-error - debugging access
      const client = window.matrixClient; // I hope it's exposed globally for debugging or I can find it
      if (!client) return 'MatrixClient not found in window';
      
      const crypto = client.getCrypto();
      if (!crypto) return 'Crypto not found';

      const userId = client.getUserId();
      const deviceId = client.getDeviceId();
      
      const verificationStatus = await crypto.getDeviceVerificationStatus(userId, deviceId);
      const crossSigningStatus = await crypto.getCrossSigningStatus();
      const backupInfo = await crypto.getKeyBackupInfo();
      
      return {
        isVerified: verificationStatus?.isVerified(),
        hasMasterKey: !!crossSigningStatus?.privateKeysCachedLocally?.masterKey,
        backupVersion: backupInfo?.version,
        deviceId
      };
    });

    console.log('CRYPTO STATE:', JSON.stringify(cryptoState, null, 2));

    await page.screenshot({ path: 'decryption-debug.png' });
    console.log('Screenshot saved to decryption-debug.png');

  } catch (err) {
    console.error('DEBUG SCRIPT FAILED:', err);
    await page.screenshot({ path: 'debug-failure.png' });
  } finally {
    await browser.close();
  }
})();
