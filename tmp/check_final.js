const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', err => {
    errors.push(err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });

  await page.goto('http://127.0.0.1:8002/admin/login/', { waitUntil: 'networkidle' });
  await page.fill('[name=username]', '黄崧');
  await page.fill('[name=password]', '1234qwer');
  await page.click('[type=submit]');
  await page.waitForURL('**/admin/**', { timeout: 10000 }).catch(() => {});
  
  await page.goto('http://127.0.0.1:8002/admin/contracts/contract/265/detail/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Click the 归档材料 tab
  const tabs = await page.$$('button');
  for (const tab of tabs) {
    const text = await tab.textContent();
    if (text.includes('归档材料')) {
      await tab.click();
      break;
    }
  }
  await page.waitForTimeout(1000);

  // Check if checklist items are rendered with auto numbering
  const checklistItems = await page.$$eval('.ac-item', items => 
    items.map(item => {
      const codeEl = item.querySelector('.ac-item-code');
      const nameEl = item.querySelector('.ac-item-name');
      const previewBtn = item.querySelector('.ac-btn-preview');
      return {
        codeBefore: codeEl ? window.getComputedStyle(codeEl, '::before').content : 'N/A',
        name: nameEl ? nameEl.textContent : '',
        hasPreview: !!previewBtn,
      };
    })
  );
  
  console.log('\n=== Checklist Items ===');
  checklistItems.slice(0, 8).forEach((item, i) => {
    console.log(`${i+1}. code="${item.codeBefore}" name="${item.name}" preview=${item.hasPreview}`);
  });

  // Check material preview buttons
  const materialPreviews = await page.$$eval('.fm-btn-preview', btns => btns.length);
  console.log(`\nMaterial preview buttons: ${materialPreviews}`);

  // Check page errors
  console.log(`\nPage errors: ${errors.length}`);
  if (errors.length > 0) {
    errors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));
  }

  await browser.close();
})();
