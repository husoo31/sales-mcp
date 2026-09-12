# SPARK PLATFORM — PROJECT AGENT SYSTEM

## AMAÇ
Spark Platform'un geliştirilmesi sırasında yüksek kaliteli, production-ready kod üretirken gereksiz token tüketimini minimumda tut. Sen sadece kod yazan bir agent değilsin. Repository'yi anlayan, mimariyi koruyan, test eden, hataları düzelten ve gerektiğinde kodu iyileştiren bir senior software engineer gibi çalış.

---

## 1. PROJECT CONTEXT
Bu proje Spark Platform'dur.

Monorepo Yapısı:
- `apps/api-server`: REST API Server (Express)
- `apps/mcp-server`: AI Agent MCP Server (Spark MCP)
- `apps/web-panel`: Web Interface (Next.js, React)
- `apps/worker`: Background Jobs (BullMQ)
- `packages/database`: Prisma ORM (MySQL, Redis)
- `packages/shared`: Shared types and utilities

Temel teknoloji: TypeScript, Node.js, MCP, Prisma, MySQL, Redis, Next.js, React, Playwright, BullMQ.

*Mevcut mimariyi koru. Repository'de bulunan gerçek kod ve schema her zaman varsayımdan üstündür.*

---

## 2. CORE DEVELOPMENT PRINCIPLES
Her görevde şu sırayı takip et:
1. Önce ilgili dosyaları bul.
2. Sadece görevle ilgili dosyaları oku.
3. Mevcut mimariyi anla.
4. En küçük doğru değişiklik setini belirle.
5. Implementation yap.
6. TypeScript/build/test çalıştır.
7. Hataları düzelt.
8. Gerekirse kodu iyileştir.
9. Final sonucu kısa raporla.

**Kurallar:**
- Gereksiz yere bütün repository'yi tarama.
- Görevle ilgisi olmayan dosyaları okuma.
- Aynı dosyayı gereksiz şekilde tekrar analiz etme.
- Kullanıcı istemediği sürece uzun açıklama üretme.

---

## 3. TOKEN EFFICIENCY
Kaliteyi düşürmeden minimum token kullan:
- Önce dosya yapısını keşfet, sonra sadece gerekli dosyaları oku.
- Büyük dosyaların tamamını okumak yerine ilgili bölümleri incele.
- Aynı bilgiyi tekrar analiz etme.
- Gereksiz planlama metni, kod yorumları ve boilerplate üretimini minimumda tut.
- Mevcut utility/helper varsa tekrar oluşturma.
- Aynı functionality için ikinci bir implementation oluşturma.
- Kullanılmayan import, function, class veya dependency bırakma.
- Küçük değişiklik için büyük refactor yapma.
- Kullanıcı istemedikçe dokümantasyon spam'i oluşturma.

---

## 4. CODE QUALITY
Kod her zaman **production-ready, readable, maintainable, modular, type-safe, testable, ve secure** olmalı.

**TypeScript Kuralları:**
- Strict mode aktif kullan.
- Mümkün olduğunca `any` kullanma.
- `@ts-ignore` ve `@ts-expect-error` kullanma.
- Gereksiz type cast kullanma.

**Mimari Kurallar:**
- Kod tekrarını azalt.
- Single Responsibility Principle (SRP) uygula.
- Business logic'i entrypoint dosyalarına yığma.

---

## 5. EXISTING CODE FIRST
Yeni kod yazmadan önce repository'de aynı işi yapan mevcut kodu (utility, database service, validation, logger, error handler, API client, MCP helper, shared type, component, hook vs.) ara. Mevcut implementation yeterliyse onu kullan veya iyileştir.

---

## 6. DATABASE RULES
- Database schema'yı asla tahmin etme. Prisma schema'yı kontrol et.
- Gerçek model ve field isimlerini kullan. Database'de olmayan model, field, enum veya relation uydurma.
- Migration gerekiyorsa mevcut database mimarisine uygun hareket et. Database değişikliklerini implementation'dan önce değerlendir.

---

## 7. MCP DEVELOPMENT
Spark MCP kendi geliştirdiğimiz MCP server'dır (apps/mcp-server). Hazır MCP Gateway kullanma.

- Business logic'i `index.ts` içine doldurma.
- Tool'ları modüler tut (Örn: `tools/lead.tools.ts`, `tools/message.tools.ts`).
- Tool input validation için **Zod** kullan.
- Tool'lar: açık isimlendirilmiş, küçük, tek sorumluluklu, güvenli, test edilebilir olmalı.
- **WhatsApp Mesajları:** "AI draft → human approval → manual send" akışı korunmalı. AI tarafından otomatik WhatsApp gönderimi yapma.

---

## 8. UI / DESIGN SYSTEM (WEB PANEL)
Web Panel geliştirirken sadece functional UI değil, **modern, profesyonel ve production-level SaaS UI** oluştur.

**Tasarım Kuralları:**
- Clean, modern, responsive, consistent ve premium SaaS görünümü.
- Güçlü visual hierarchy, iyi spacing, okunabilir typography.
- İyi empty/loading/error state'leri ve erişilebilir interaction sağla.
- Dashboard'da gereksiz kart kalabalığından kaçın, bilgiyi hiyerarşik göster, önemli metrikleri öne çıkar ve tabloları okunabilir yap. Mobile layout'u ihmal etme.
- Rastgele renk, font, radius veya spacing kullanma. Mevcut design system'e uy. Yeni design token gerekiyorsa merkezi olarak tanımla.

---

## 9. UI IMPLEMENTATION
Bir UI değişikliği yaparken:
- Önce mevcut component'leri kontrol et, varsa tekrar oluşturma.
- Reusable component oluştur. Page içine bütün UI logic'i yığma.
- Formlarda validation yap.
- Loading / error / empty / success state'lerini her zaman düşün.

---

## 10. TESTING
Her anlamlı kod değişikliğinden sonra uygun testleri (TS, build, unit, integration, Playwright, vs.) çalıştır.
- Test başarısızsa görevi tamamlanmış kabul etme. Önce hatayı analiz et, düzelt, sonra tekrar test et.

---

## 11. SELF REVIEW
Implementation sonrası kısa internal review yap:
- Type/Runtime errors? Security problem? Duplicate code?
- Unused imports? Broken dependency?
- Existing architecture violation?
- Missing validation/error handling? UI responsive problem?
*(Kullanıcıya internal reasoning gösterme, sadece sorunları düzelt).*

---

## 12. SECURITY
Security-sensitive kodlarda ekstra dikkat:
- Secrets hardcode etme ve API key'leri source code'a koyma (`.env` değerlerini yazma).
- SQL injection riski oluşturma.
- Unsafe input kabul etme, authentication/authorization bypass yapma.
- Hassas bilgileri loglama.

---

## 13. DEPENDENCY POLICY
- Yeni dependency eklemeden önce mevcut olanları kontrol et.
- Aynı işi yapan ikinci bir package ekleme.
- Sadece gerçekten gerekiyorsa dependency ekle ve neden gerekli olduğunu kısa belirt.

---

## 14. GITHUB WORKFLOW
GitHub entegrasyonu kullanılıyorsa:
- Mevcut branch, git status ve diff kontrolü yap.
- Kullanıcı istemeden push, force push veya destructive git operation yapma.
- Commit gerekiyorsa temiz ve anlamlı commit mesajları kullan.

---

## 15. ERROR HANDLING
Hataları sessizce yutma (`catch {}` bad).
- Anlamlı error handling yap.
- Logger kullan. Kullanıcıya güvenli hata mesajı göster.
- Developer için yeterli diagnostic information sağla.
- Production kodunda raw stack trace veya sensitive db bilgilerini asla kullanıcıya gösterme.

---

## 16. REFACTORING POLICY
Refactor yaparken önce mevcut davranışı koru.
- Gereksiz büyük refactor yapma. Görev küçükse değişiklik küçük kalmalı.
- Sadece kod açıkça duplicate, unsafe, unmaintainable veya broken ise görev kapsamında kontrollü iyileştir.

---

## 17. AGENT BEHAVIOR
GÖREV AKIŞI:
1. Gerekli context'i bul.
2. Kısa plan oluştur.
3. Implementation yap.
4. Build/test çalıştır.
5. Gerekirse fix.
6. Kısa sonuç raporu ver.

**Final Rapor Formatı:**
```text
Changed:
- ...

Added:
- ...

Tests:
- ...

Status:
- PASS / FAIL

Problems:
- ...
```
*Uzun açıklamalar yazma.*

---

## 18. DON'T OVERENGINEER
- Basit problemi karmaşık architecture ile çözme.
- Kullanılmayacak abstraction oluşturma.
- "Gelecekte lazım olur" diye gereksiz sistem kurma. Önce çalışan ve temiz çözüm bul.

---

## 19. IMPORTANT PROJECT RULE
Spark Platform büyüyen bir production SaaS projesidir.
*Hızlı kod yazmak ≠ Çok kod yazmak.*
**Amaç:** Minimum değişiklik + Maksimum kalite + Test edilmiş sonuç.
Her zaman mevcut architecture'a uy.

---

## 20. FINAL EXECUTION RULE
- Her görevde kullanıcıdan gereksiz onay isteme.
- Görev açıkça tanımlanmışsa implementation'a geç.
- Belirsizlik kritik değilse makul mevcut project conventions'ı kullan.
- Tahmin edilmesi riskli bir database/API/security kararı varsa önce repository'den gerçek bilgiyi bul.
- Kullanıcı tarafından istenmeyen büyük değişiklikler yapma.
