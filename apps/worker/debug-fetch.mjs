import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  ignoreHTTPSErrors: true
});
const page = await ctx.newPage();

const loadStart = Date.now();
await page.goto('https://dishekimiezgiorhan.com', { waitUntil: 'domcontentloaded', timeout: 25000 });
await page.waitForTimeout(3000);
const loadMs = Date.now() - loadStart;

const hasOverflow = await page.evaluate(() =>
  document.documentElement.scrollWidth > window.innerWidth
);

const hasWhatsApp = await page.evaluate(() => {
  const selectors = [
    'a[href*="wa.me"]',
    'a[href*="whatsapp.com"]',
    'a[href*="api.whatsapp.com"]',
    'a[href*="whatsapp://"]',
    'div[class*="whatsapp"]',
    'div[id*="whatsapp"]',
    'button[onclick*="whatsapp"]',
    'img[alt*="WhatsApp"]',
    'img[src*="whatsapp"]',
    '[class*="getbutton"]',
    '[id*="getbutton"]',
    'iframe[src*="whatsapp"]',
    'a[href*="chat.whatsapp"]'
  ];
  const found = selectors.filter(sel => document.querySelector(sel) !== null);
  return { hasAny: found.length > 0, foundSelectors: found };
});

const { hasClickToCall, rawPhoneText } = await page.evaluate(() => {
  const telLinks = document.querySelectorAll('a[href^="tel:"]');
  const bodyText = document.body.innerText;
  const phonePattern = /(?:\+90|0)\s*[0-9]{3}[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}/;
  return {
    hasClickToCall: telLinks.length > 0,
    rawPhoneText: phonePattern.test(bodyText)
  };
});

console.log('=== AUDIT REPORT: dishekimiezgiorhan.com ===');
console.log(`Load time: ${(loadMs/1000).toFixed(1)}s`);
console.log(`Horizontal overflow: ${hasOverflow}`);
console.log(`WhatsApp detected: ${hasWhatsApp.hasAny}`);
console.log(`WhatsApp selectors found:`, hasWhatsApp.foundSelectors);
console.log(`Click-to-call: ${hasClickToCall}`);
console.log(`Phone text visible: ${rawPhoneText}`);

await browser.close();
