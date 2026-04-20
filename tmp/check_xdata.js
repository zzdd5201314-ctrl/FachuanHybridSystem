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

  // Find all x-data attributes
  const xDataValues = await page.evaluate(() => {
    const elements = document.querySelectorAll('[x-data]');
    return Array.from(elements).map(el => ({
      tag: el.tagName,
      xData: el.getAttribute('x-data').substring(0, 300),
      outerHTML: el.outerHTML.substring(0, 500)
    }));
  });
  
  console.log('=== All x-data elements ===');
  xDataValues.forEach((v, i) => {
    console.log(`\n--- Element ${i+1} (${v.tag}) ---`);
    console.log('x-data:', v.xData);
  });

  await browser.close();
})();
