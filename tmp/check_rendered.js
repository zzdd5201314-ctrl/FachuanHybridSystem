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

  // Get computed style of ::before pseudo-element
  const counters = await page.$$eval('.ac-item-code', els => 
    els.map(el => {
      const style = window.getComputedStyle(el, '::before');
      return {
        content: style.content,
        display: style.display,
      };
    })
  );
  console.log('=== CSS Counter ::before content ===');
  counters.slice(0, 8).forEach((c, i) => {
    console.log(`  ${i+1}: content="${c.content}" display="${c.display}"`);
  });

  await browser.close();
})();
