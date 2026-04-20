const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Capture all page errors with stack traces
  const errors = [];
  page.on('pageerror', err => {
    errors.push({ message: err.message, stack: err.stack });
  });

  await page.goto('http://127.0.0.1:8002/admin/login/', { waitUntil: 'networkidle' });
  await page.fill('[name=username]', '黄崧');
  await page.fill('[name=password]', '1234qwer');
  await page.click('[type=submit]');
  await page.waitForURL('**/admin/**', { timeout: 10000 }).catch(() => {});
  
  await page.goto('http://127.0.0.1:8002/admin/contracts/contract/265/detail/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Print first error with stack
  if (errors.length > 0) {
    console.log('=== First Error ===');
    console.log('Message:', errors[0].message);
    console.log('Stack:', errors[0].stack);
  }

  await browser.close();
})();
