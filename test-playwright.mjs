import { chromium } from 'playwright';

(async () => {
  try {
    const browser = await chromium.launch({ channel: 'chrome' });
    console.log('Browser launched successfully');
    await browser.close();
  } catch (error) {
    console.error('Failed to launch browser:');
    console.error(error.message);
    process.exit(1);
  }
})();
