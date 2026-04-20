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

  // Click 归档材料 tab
  const tabs = await page.$$('button');
  for (const tab of tabs) {
    const text = await tab.textContent();
    if (text.includes('归档材料')) {
      await tab.click();
      break;
    }
  }
  await page.waitForTimeout(1000);

  // Take a screenshot
  await page.screenshot({ path: 'tmp/archive_checklist.png', fullPage: false });

  // Get the rendered text content of checklist items
  const items = await page.$$eval('.ac-item-code', els => 
    els.map(el => el.textContent.trim())
  );
  console.log('=== Checklist item codes (rendered) ===');
  items.forEach((t, i) => console.log(`  ${i+1}: "${t}"`));

  await browser.close();
})();
