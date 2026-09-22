import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  const heroWatch = page.getByRole('link', { name: 'Watch', exact: true }).first();
  if (await heroWatch.isVisible()) {
    console.log('Clicking hero Watch button...');
    await heroWatch.click();
    await page.waitForTimeout(4000);
    console.log('Post-click URL:', page.url());
    await page.screenshot({ path: 'screenshot-player-active.png' });
  } else {
    console.log('Hero Watch button not visible');
  }
  await browser.close();
  console.log('Test complete!');
})();