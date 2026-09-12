import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';

let context: BrowserContext | null = null;
let page: Page | null = null;

export async function initWhatsApp() {
  if (!context) {
    const profilePath = path.resolve(process.cwd(), './whatsapp-profile');
    
    // Ensure the directory exists
    if (!fs.existsSync(profilePath)) {
      fs.mkdirSync(profilePath, { recursive: true });
    }

    console.log('Launching Playwright with persistent context...');
    context = await chromium.launchPersistentContext(profilePath, {
      headless: false, // Keep browser open for manual scanning and sending
      viewport: null // Default viewport
    });
    
    const pages = context.pages();
    page = pages.length > 0 ? pages[0] : await context.newPage();
    
    console.log('Playwright context initialized.');
  }
}

export async function prepareWhatsAppMessage(phone: string, text: string) {
  await initWhatsApp();
  
  if (!page) {
    throw new Error('Playwright page is not initialized');
  }

  // Clean phone to 90 format
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '9' + cleanPhone;
  } else if (cleanPhone.length === 10 && !cleanPhone.startsWith('90')) {
    cleanPhone = '90' + cleanPhone;
  }

  console.log(`Navigating to WhatsApp Web for phone: ${cleanPhone}...`);
  const url = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
  
  // Navigate and wait for network idle to ensure scripts are loaded
  await page.goto(url, { waitUntil: 'load' });
  
  console.log('Waiting for the message input box to appear...');
  // Wait for the message input box to appear in the DOM
  // In WhatsApp Web, the message box has contenteditable="true"
  await page.waitForSelector('div[contenteditable="true"]', { state: 'visible', timeout: 60000 });
  
  console.log('Message is ready in the input box. Waiting for manual send...');
  // CRITICAL: DO NOT CLICK SEND OR PRESS ENTER. Leave it for manual send.
}
