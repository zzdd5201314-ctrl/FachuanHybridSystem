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

  // Get the page HTML to find the problematic JS
  const html = await page.content();
  
  // Find inline scripts and check for issues
  const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (let i = 0; i < scriptMatches.length; i++) {
    const content = scriptMatches[i];
    // Look for the folderScanApp or contractFolderScanApp function
    if (content.includes('contractFolderScanApp') || content.includes('folderScanApp')) {
      console.log(`=== Script block ${i+1} (folderScanApp) ===`);
      console.log(content.substring(0, 500));
      console.log('...');
    }
  }

  // Look for the first error source
  const firstError = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      if (s.textContent.includes('contractFolderScanApp')) {
        return s.textContent.substring(0, 1000);
      }
    }
    return 'NOT FOUND';
  });
  console.log('\n=== contractFolderScanApp script content ===');
  console.log(firstError);
  
  await browser.close();
})();
