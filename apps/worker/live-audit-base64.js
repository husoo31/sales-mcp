import { chromium } from 'playwright';
import { PrismaClient } from '@spark/database';

const prisma = new PrismaClient();

const EXCLUDED_DOMAINS = [
  'google', 'bing', 'doktortakvimi', 'armut', 'bionluk',
  'sahibinden', 'instagram', 'facebook', 'youtube', 'linkedin',
  'twitter', 'foursquare', 'yandex', 'yelp', 'tripadvisor',
  'sikayetvar', 'duckduckgo', 'wikipedia', 'maps.apple',
  'web.archive', 'waze.com'
];

function isExcluded(url) {
  return EXCLUDED_DOMAINS.some(d => url.includes(d));
}

function isFixedLine(phone) {
  const clean = phone.replace(/[\s\-().+ ]/g, '');
  return (
    /^0?(212|216|312|232|224|342|262|264|268|272|274|282|288|258|252|242|236|226|222|284|286|228|248|246|244|234|266|276)/.test(clean) ||
    /^0?444/.test(clean) ||
    /^0?850/.test(clean)
  );
}

function extractMobilePhone(text) {
  const waMatch = text.match(/wa\.me\/(?:\+?90)?(5[0-9]{9})/);
  if (waMatch) return '0' + waMatch[1];
  const m = text.match(/(?:\+90|0)\s*5[0-9]{2}[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}/);
  return m ? m[0].replace(/\s+/g, ' ').trim() : null;
}

// Google Maps'ten klinik sitelerini çek (domcontentloaded — hızlı ve çalışıyor)
async function discoverFromMaps(browser, district, targetCount) {
  const query = `${district} diş kliniği`;
  console.log(`\n🗺️  Google Maps üzerinde "${query}" araması yapılıyor...`);

  const context = await browser.newContext({
    locale: 'tr-TR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'tr-TR,tr;q=0.9' }
  });
  const page = await context.newPage();

  let urls = [];
  try {
    // domcontentloaded = çok daha hızlı, networkidle Maps'te timeout yapıyor
    await page.goto(
      `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
      { waitUntil: 'domcontentloaded', timeout: 20000 }
    );
    await page.waitForTimeout(4000); // JS render için bekle

    // Maps'in sidebar'ından dış site linklerini çek
    urls = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.href)
        .filter(h => {
          if (!h.startsWith('http')) return false;
          const skip = ['google.com', 'gstatic.com', 'googleapis.com', 'maps.google'];
          return !skip.some(s => h.includes(s));
        });
    });

    // Tekilleştir ve domain bazlı grupla
    const seen = new Set();
    const unique = [];
    for (const url of urls) {
      try {
        const origin = new URL(url).origin;
        if (!seen.has(origin) && !isExcluded(url)) {
          seen.add(origin);
          unique.push(origin);
        }
      } catch { /* geçersiz */ }
    }

    console.log(`   📍 ${unique.length} adet klinik web sitesi tespit edildi.`);
    await page.close();
    await context.close();
    return unique.slice(0, targetCount * 4);
  } catch (e) {
    console.error('   ❌ Maps hatası:', e.message.slice(0, 120));
    await page.close();
    await context.close();
    return [];
  }
}

// Klinik sitesini ziyaret et, isim ve telefon çek
async function lookupPhoneFromSite(browser, siteUrl) {
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: true
  });
  const page = await ctx.newPage();
  let phone = null;
  let name = null;

  try {
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);

    const { text, title, waHref } = await page.evaluate(() => {
      const waLink = document.querySelector('a[href*="wa.me"], a[href*="whatsapp"]');
      return {
        text: document.body.innerText,
        title: document.title,
        waHref: waLink ? waLink.href : null
      };
    });

    phone = extractMobilePhone(text);
    if (!phone && waHref) {
      const wm = waHref.match(/wa\.me\/(?:\+?90)?(5[0-9]{9})/);
      if (wm) phone = '0' + wm[1];
    }

    name = title.split(/[-|–|·]/)[0].trim() || new URL(siteUrl).hostname.replace('www.', '');
  } catch { /* erişim hatası */ }
  finally {
    await page.close();
    await ctx.close();
  }

  return { phone, name };
}

// Çok aşamalı gerçek denetim — sırayla kontrol et, bulduğunda dur
async function auditClinic(browser, candidate) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    ignoreHTTPSErrors: true
  });
  const page = await ctx.newPage();

  try {
    const loadStart = Date.now();
    await page.goto(candidate.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(3000);
    const loadMs = Date.now() - loadStart;

    // Cookie/popup gizle
    await page.evaluate(() => {
      document.querySelectorAll(
        '[id*="cookie"],[class*="cookie"],[id*="popup"],[class*="consent"],[id*="banner"]'
      ).forEach(el => { if (el instanceof HTMLElement) el.style.display = 'none'; });
    });

    // ─── KONTROL 1: Gerçek Yatay Taşma ───
    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth
    );

    // ─── KONTROL 2: WhatsApp Varlığı (KESİN SELECTOR'LARLA) ───
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
        '[class*="getbutton"]',   // GetButton widget
        '[id*="getbutton"]',
        'iframe[src*="whatsapp"]',
        'a[href*="chat.whatsapp"]'
      ];
      return selectors.some(sel => document.querySelector(sel) !== null);
    });

    // ─── KONTROL 3: Click-to-Call varlığı ───
    const { hasClickToCall, rawPhoneText } = await page.evaluate(() => {
      const telLinks = document.querySelectorAll('a[href^="tel:"]');
      const bodyText = document.body.innerText;
      const phonePattern = /(?:\+90|0)\s*[0-9]{3}[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}/;
      return {
        hasClickToCall: telLinks.length > 0,
        rawPhoneText: phonePattern.test(bodyText)
      };
    });

    // ─── SORUN TESPİT HİYERARŞİSİ ───
    let problemDesc = '';
    let draftContent = '';
    let overlayLabel = '';
    let issueType = '';

    if (hasOverflow) {
      // 1. Öncelik: Gerçek yatay taşma
      overlayLabel = '⚠ Kritik: Mobilde Yatay Taşma (Horizontal Overflow)';
      problemDesc = 'Mobil arayüzde yatay taşma (horizontal overflow) tespit edildi. Sayfa genişliği mobil ekrana sığmıyor; Google Core Web Vitals skoru ve kullanıcı deneyimi olumsuz etkileniyor.';
      draftContent = `Merhabalar, ${candidate.name} web sitenizi mobilden inceledik. Sayfanız mobil cihaz ekranlarından taşıyor (yatay kaydırma sorunu). Bu hem kullanıcı deneyimini bozuyor hem de Google sıralamanızı düşürüyor. Teknik kanıtı ekran görüntüsüyle paylaşabiliriz. Çözmek için sizi arayabilir miyiz?`;
      issueType = 'OVERFLOW';
    } else if (rawPhoneText && !hasClickToCall) {
      // 2. Öncelik: Telefon var ama tıklanamıyor
      overlayLabel = '⚠ Tıklanabilir Telefon (Click-to-Call) Eksik';
      problemDesc = 'Mobil arayüzde telefon numarası görünüyor ancak doğrudan aranabilir (tel: protokolü) link bulunmuyor. Mobil kullanıcılar numarayı manuel kopyalamak zorunda kalıyor; bu hasta kaybına yol açıyor.';
      draftContent = `Merhabalar, ${candidate.name} mobil sitenizi inceledik. Telefon numaranız görünüyor ancak mobil kullanıcıların tek tıkla arayabilmesini sağlayan "Click-to-Call" butonu eksik. Bu küçük iyileştirme hasta dönüşümünüzü doğrudan artırır. Sizi bilgilendirmek isteriz.`;
      issueType = 'NO_CLICK_TO_CALL';
    } else if (loadMs > 5000) {
      // 3. Öncelik: Sayfa yavaş açılıyor
      const loadSec = (loadMs / 1000).toFixed(1);
      overlayLabel = `⚠ Mobil Yükleme Yavaş: ${loadSec}s`;
      problemDesc = `Mobil sayfa yükleme süresi ${loadSec} saniye. Google'ın eşiği (3s) aşıldığı için hem arama sıralaması düşüyor hem de ziyaretçiler randevu almadan sayfayı terk edebiliyor.`;
      draftContent = `Merhabalar, ${candidate.name} mobil sitenizi test ettik. Sayfa açılış süreniz ${loadSec} saniye; bu Google'ın önerdiği 3 saniyenin üzerinde. Yavaş yükleme arama sıralamanızı ve hasta dönüşümünüzü olumsuz etkiliyor. Teknik raporumuzu paylaşabilir miyiz?`;
      issueType = 'SLOW_LOAD';
    } else if (!hasWhatsApp) {
      // 4. Öncelik: WhatsApp gerçekten yoksa
      overlayLabel = '⚠ WhatsApp İletişim Butonu Eksik';
      problemDesc = 'Mobil sitede WhatsApp entegrasyonu (wa.me linki, WhatsApp butonu veya widget) tespit edilemedi. Hastaların anlık iletişim kurmasını sağlayan bu kanal eksik olduğunda randevu dönüşüm oranı düşüyor.';
      draftContent = `Merhabalar, ${candidate.name} mobil sitenizi inceledik. Hastaların anında WhatsApp üzerinden ulaşabileceği bir iletişim butonu bulunmuyor. Rekabet eden kliniklerin büyük çoğunluğunda bu özellik mevcut; sizi de bu konuda bilgilendirmek istedik.`;
      issueType = 'NO_WHATSAPP';
    } else {
      // 5. Gerçek bir kritik sorun yok — genel iyileştirme fırsatı
      overlayLabel = '💡 Dönüşüm Optimizasyon Fırsatı';
      problemDesc = 'Mobil site temel kriterleri karşılıyor (WhatsApp mevcut, telefon bağlantısı çalışıyor, hız kabul edilebilir). Ancak randevu dönüşümünü artırabilecek CTA yerleşimi ve form optimizasyonu iyileştirme fırsatı sunuyor.';
      draftContent = `Merhabalar, ${candidate.name} mobil sitenizi inceledik. Teknik altyapınız sağlam görünüyor. Randevu dönüşüm oranınızı artırabilecek küçük UX iyileştirmeleri konusunda kısa bir görüşme yapabilir miyiz?`;
      issueType = 'GENERAL_UX';
    }

    console.log(`   🔍 Denetim sonucu: ${issueType} | WA:${hasWhatsApp ? '✅' : '❌'} | Tel:${hasClickToCall ? '✅' : '❌'} | Overflow:${hasOverflow ? '⚠️' : '✓'} | Hız:${(loadMs / 1000).toFixed(1)}s`);

    // Etiket sadece gerçek sorun varsa çiz (genel UX fırsatında overlay yok)
    if (issueType !== 'GENERAL_UX') {
      await page.evaluate((label) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:100px;left:0;right:0;margin:auto;width:88%;height:56px;border:4px dashed #ef4444;background:rgba(239,68,68,0.08);z-index:9999999;pointer-events:none;border-radius:8px;';
        const badge = document.createElement('div');
        badge.style.cssText = 'position:absolute;top:-18px;left:10px;background:#ef4444;color:#fff;font-size:11px;font-weight:bold;padding:4px 10px;border-radius:4px;white-space:nowrap;font-family:sans-serif';
        badge.innerText = label;
        overlay.appendChild(badge);
        document.body.appendChild(overlay);
      }, overlayLabel);
    }

    const screenshotBuf = await page.screenshot({ fullPage: false });
    const screenshotBase64 = `data:image/png;base64,${screenshotBuf.toString('base64')}`;

    return { problemDesc, draftContent, screenshotBase64, hasOverflow, issueType };
  } finally {
    await page.close();
    await ctx.close();
  }
}

async function main() {
  const district = process.argv[2] || 'Kadıköy';
  const targetCount = parseInt(process.argv[3] || '5', 10);

  console.log(`\n🚀 Spark Otonom Live Audit — Hedef: ${district} | Adet: ${targetCount}`);
  console.log('━'.repeat(60));

  const browser = await chromium.launch({ headless: true });

  // 1. Google Maps'ten URL keşfi
  const urls = await discoverFromMaps(browser, district, targetCount);

  if (urls.length === 0) {
    console.log('\n❌ Hiç URL bulunamadı. Çıkılıyor.');
    await browser.close();
    await prisma.$disconnect();
    return;
  }

  // 2. Sitelere girerek telefon ve isim bilgisi al, sabit hatları ele
  const validCandidates = [];
  console.log(`\n📞 ${urls.length} site telefon bilgisi için taranıyor...`);

  for (const siteUrl of urls) {
    if (validCandidates.length >= targetCount * 2) break;

    process.stdout.write(`   🌐 ${siteUrl} ... `);
    const { phone, name } = await lookupPhoneFromSite(browser, siteUrl);

    if (!phone) {
      console.log('⚠️  Mobil telefon yok');
      continue;
    }

    if (isFixedLine(phone)) {
      console.log(`[!] Sabit hat elendi: ${name} (${phone})`);
      continue;
    }

    console.log(`✅ ${name} | ${phone}`);
    validCandidates.push({ name, phone, url: siteUrl });
  }

  if (validCandidates.length === 0) {
    console.log('\n❌ Geçerli mobil hat bulunamadı. Tarama sonlandırıldı.');
    await browser.close();
    await prisma.$disconnect();
    return;
  }

  // 3. Mobil audit + DB kayıt
  console.log(`\n📋 ${validCandidates.length} geçerli aday. Audit döngüsü başlıyor...`);
  console.log('━'.repeat(60));

  let processed = 0;
  for (const candidate of validCandidates) {
    if (processed >= targetCount) break;

    console.log(`\n[${processed + 1}/${targetCount}] Denetleniyor: ${candidate.name}`);
    try {
      const audit = await auditClinic(browser, candidate);

      await prisma.lead.create({
        data: {
          clinicName: candidate.name,
          phone: candidate.phone,
          city: 'İstanbul',
          district: district,
          status: 'WAITING_APPROVAL',
          website: candidate.url,
          problem: audit.problemDesc,
          drafts: {
            create: {
              content: audit.draftContent,
              status: 'WAITING_APPROVAL',
              screenshotUrl: audit.screenshotBase64
            }
          }
        }
      });

      console.log(`   💾 DB'ye kaydedildi! (Overflow: ${audit.hasOverflow ? '⚠️  VAR' : '✓ Yok'})`);
      processed++;
    } catch (err) {
      console.error(`   ❌ Hata: ${candidate.name} — ${err.message}`);
    }
  }

  console.log('\n' + '━'.repeat(60));
  console.log(`✅ Tarama tamamlandı! ${processed}/${targetCount} işletme onay kuyruğuna eklendi.`);

  await browser.close();
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
