const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://127.0.0.1:8002/admin/login/', { waitUntil: 'networkidle' });
  await page.fill('[name=username]', '黄崧');
  await page.fill('[name=password]', '1234qwer');
  await page.click('[type=submit]');
  await page.waitForURL('**/admin/**', { timeout: 10000 }).catch(() => {});
  
  await page.goto('http://127.0.0.1:8002/admin/contracts/contract/265/detail/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Get the full x-data attribute for the contractFolderScanApp element
  const fullXData = await page.evaluate(() => {
    const el = document.querySelector('[x-data*="contractFolderScanApp"]');
    return el ? el.getAttribute('x-data') : 'NOT FOUND';
  });
  
  console.log(fullXData);

  await browser.close();
})();
