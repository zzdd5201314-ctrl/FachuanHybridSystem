const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push('PAGE ERROR: ' + err.message);
  });

  await page.goto('http://127.0.0.1:8002/admin/login/', { waitUntil: 'networkidle' });
  await page.fill('[name=username]', '黄崧');
  await page.fill('[name=password]', '1234qwer');
  await page.click('[type=submit]');
  await page.waitForURL('**/admin/**', { timeout: 10000 }).catch(() => {});
  
  // Navigate to contract detail
  await page.goto('http://127.0.0.1:8002/admin/contracts/contract/265/detail/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Collect all errors
  console.log('=== Console Errors ===');
  errors.forEach((e, i) => console.log(`${i+1}. ${e}`));
  if (errors.length === 0) console.log('No errors found.');
  
  await browser.close();
})();
