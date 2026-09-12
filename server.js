import express from "express";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    isInitializeRequest
} from "@modelcontextprotocol/sdk/types.js";

const app = express();
const PORT = 3000;

const LEADS_FILE = path.join(process.cwd(), "leads.json");
const WHATSAPP_PROFILE = path.join(process.cwd(), "whatsapp-profile");
const execFileAsync = promisify(execFile);

let whatsappContext = null;
const whatsappPages = new Map();
const whatsappQueue = new Map();

function normalizePhone(phone) {
    let normalized = String(phone || "").replace(/[^0-9]/g, "");

    if (normalized.startsWith("00")) {
        normalized = normalized.slice(2);
    }

    if (normalized.startsWith("0") && normalized.length === 11) {
        normalized = "90" + normalized.slice(1);
    }

    if (!normalized.startsWith("90") && normalized.length === 10) {
        normalized = "90" + normalized;
    }

    return normalized;
}

async function getWhatsAppContext() {
    if (whatsappContext) return whatsappContext;

    whatsappContext = await chromium.launchPersistentContext(
        WHATSAPP_PROFILE,
        {
            headless: false,
            viewport: { width: 1280, height: 900 },
            args: [
                "--start-minimized",
                "--disable-notifications"
            ]
        }
    );

    whatsappContext.on("close", () => {
        whatsappContext = null;
        whatsappPages.clear();
    });

    let pages = whatsappContext.pages();
    let page = pages[0];

    if (!page) {
        page = await whatsappContext.newPage();
    }

    if (!page.url().includes("web.whatsapp.com")) {
        await page.goto("https://web.whatsapp.com", { waitUntil: "domcontentloaded" });
    }

    return whatsappContext;
}

async function prepareWhatsAppPage({ leadId, phone, message, clinicName }) {
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone || normalizedPhone.length < 10) {
        throw new Error(`Geçersiz telefon numarası: ${phone}`);
    }

    const context = await getWhatsAppContext();
    const page = await context.newPage();

    whatsappPages.set(leadId || normalizedPhone, page);
    whatsappQueue.set(leadId || normalizedPhone, {
        leadId: leadId || null,
        clinicName: clinicName || "",
        phone,
        normalizedPhone,
        message,
        status: "OPENING"
    });

    const url =
        `https://web.whatsapp.com/send?phone=${normalizedPhone}&text=` +
        encodeURIComponent(message || "");

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // WhatsApp Web yüklenirken sohbet/uyarı ekranını bekle.
    try {
        await page.waitForTimeout(3500);
    } catch {}

    let pageText = "";
    try {
        pageText = (await page.locator("body").innerText()).toLowerCase();
    } catch {}

    const invalidNumber =
        pageText.includes("phone number shared via url is invalid") ||
        pageText.includes("telefon numarası geçersiz") ||
        pageText.includes("telefon numarası whatsapp'ta kayıtlı değil") ||
        pageText.includes("phone number isn't on whatsapp");

    const item = whatsappQueue.get(leadId || normalizedPhone);
    if (item) {
        item.status = invalidNumber
            ? "NOT_ON_WHATSAPP"
            : "READY_FOR_MANUAL_SEND";
    }

    // Mesajı gönderme: Enter/click kesinlikle yapılmıyor.
    return {
        normalizedPhone,
        url,
        status: invalidNumber
            ? "NOT_ON_WHATSAPP"
            : "READY_FOR_MANUAL_SEND"
    };
}

async function showWhatsAppPage(key) {
    const page = whatsappPages.get(key);
    if (!page || page.isClosed()) {
        return false;
    }

    await page.bringToFront();

    // Windows'ta minimize edilmiş Chromium penceresini öne çıkarmayı dene.
    try {
        await execFileAsync("powershell.exe", [
            "-NoProfile",
            "-Command",
            `Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Win32 {
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@; $p=Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*WhatsApp*' } | Select-Object -First 1; if ($p) { [Win32]::ShowWindowAsync($p.MainWindowHandle,9) | Out-Null; [Win32]::SetForegroundWindow($p.MainWindowHandle) | Out-Null }`
        ], { windowsHide: true });
    } catch {}

    return true;
}

async function closePreparedWhatsAppPage(key) {
    const page = whatsappPages.get(key);
    if (page && !page.isClosed()) {
        await page.close();
    }
    whatsappPages.delete(key);
    whatsappQueue.delete(key);
}

// ======================================================
// JSON BODY PARSER
// ======================================================

app.use(express.json());

// ======================================================
// MCP SESSIONLARI
// ======================================================

const sessions = new Map();

// ======================================================
// LEADS DOSYA SISTEMI
// ======================================================

async function ensureLeadsFile() {
    try {
        await fs.access(LEADS_FILE);
    } catch {
        await fs.writeFile(
            LEADS_FILE,
            JSON.stringify([], null, 2),
            "utf8"
        );
    }
}

async function readLeads() {
    try {
        await ensureLeadsFile();

        const data = await fs.readFile(
            LEADS_FILE,
            "utf8"
        );

        if (!data.trim()) {
            return [];
        }

        const leads = JSON.parse(data);

        return Array.isArray(leads) ? leads : [];

    } catch (error) {

        console.error("[LEADS READ ERROR]", error);

        return [];
    }
}

async function writeLeads(leads) {

    await fs.writeFile(
        LEADS_FILE,
        JSON.stringify(leads, null, 2),
        "utf8"
    );
}

// ======================================================
// MCP SERVER
// ======================================================

function createMcpServer() {

    const server = new Server(
        {
            name: "spark-sales-mcp",
            version: "1.0.0"
        },
        {
            capabilities: {
                tools: {}
            }
        }
    );

    // ==================================================
    // TOOLS LIST
    // ==================================================

    server.setRequestHandler(
        ListToolsRequestSchema,
        async () => {

            return {
                tools: [

                    // ----------------------------------
                    // GET STATUS
                    // ----------------------------------

                    {
                        name: "get_status",

                        description:
                            "Spark Sales MCP sunucusunun durumunu kontrol eder.",

                        inputSchema: {
                            type: "object",
                            properties: {}
                        }
                    },

                    // ----------------------------------
                    // GET LEADS
                    // ----------------------------------

                    {
                        name: "get_leads",

                        description:
                            "leads.json içindeki tüm müşteri adaylarını getirir.",

                        inputSchema: {
                            type: "object",
                            properties: {}
                        }
                    },

                    // ----------------------------------
                    // ADD LEAD
                    // ----------------------------------

                    {
                        name: "add_lead",

                        description:
                            "Yeni bir müşteri adayını leads.json dosyasına kaydeder.",

                        inputSchema: {

                            type: "object",

                            properties: {

                                clinicName: {
                                    type: "string",
                                    description:
                                        "Klinik veya işletme adı."
                                },

                                phone: {
                                    type: "string",
                                    description:
                                        "Birincil telefon numarası."
                                },

                                phoneNumbers: {
                                    type: "array",
                                    items: { type: "string" },
                                    description:
                                        "Klinik için bulunan tüm telefon numaraları. Sistem bunları tek tek WhatsApp Web'de kontrol eder."
                                },

                                district: {
                                    type: "string",
                                    description:
                                        "İlçe."
                                },

                                city: {
                                    type: "string",
                                    description:
                                        "Şehir."
                                },

                                website: {
                                    type: "string",
                                    description:
                                        "Web sitesi URL'si."
                                },

                                websiteStatus: {
                                    type: "string",
                                    description:
                                        "no-website, bad, outdated, broken, improvable, professional gibi durum."
                                },

                                category: {
                                    type: "string",
                                    description:
                                        "Lead kategorisi."
                                },

                                websiteScore: {
                                    type: "number",
                                    description:
                                        "Web sitesi puanı 0-100."
                                },

                                leadScore: {
                                    type: "number",
                                    description:
                                        "Lead satış puanı 0-100."
                                },

                                googleRating: {
                                    type: "number",
                                    description:
                                        "Google puanı."
                                },

                                googleReviews: {
                                    type: "number",
                                    description:
                                        "Google yorum sayısı."
                                },

                                problem: {
                                    type: "string",
                                    description:
                                        "Tespit edilen temel web problemi."
                                },

                                opportunity: {
                                    type: "string",
                                    description:
                                        "Satış fırsatı."
                                },

                                offer: {
                                    type: "string",
                                    description:
                                        "Önerilecek hizmet."
                                },

                                source: {
                                    type: "string",
                                    description:
                                        "Lead kaynağı."
                                },

                                notes: {
                                    type: "string",
                                    description:
                                        "Ek araştırma notları."
                                }

                            },

                            required: [
                                "clinicName"
                            ]
                        }
                    },

                    // ----------------------------------
                    // PREPARE WHATSAPP
                    // ----------------------------------

                    {
                        name: "prepare_whatsapp_message",

                        description:
                            "Bir lead için WhatsApp mesajını hazırlar. Lead ID verildiğinde telefon numarasını leads.json içinden otomatik bulur. Mesaj göndermez; kullanıcı onayı bekler.",

                        inputSchema: {

                            type: "object",

                            properties: {

                                leadId: {
                                    type: "string",
                                    description: "Leads.json içindeki lead ID."
                                },

                                clinicName: {
                                    type: "string",
                                    description: "Klinik adı. leadId kullanılmıyorsa verilebilir."
                                },

                                phone: {
                                    type: "string",
                                    description: "Telefon numarası. leadId kullanılıyorsa otomatik bulunur."
                                },

                                message: {
                                    type: "string",
                                    description: "Gönderilmek üzere hazırlanacak kişiselleştirilmiş WhatsApp mesajı."
                                }

                            },

                            required: [
                                "message"
                            ]
                        }
                    },

                    // ----------------------------------
                    // PREPARE WHATSAPP WEB
                    // ----------------------------------

                    {
                        name: "prepare_whatsapp_web",
                        description:
                            "WhatsApp Web'i arka planda açar, lead numarasıyla sohbeti doğrudan açar ve mesajı gönderilmeden hazırlar. Rehbere kayıt yapmaz ve Gönder butonuna basmaz.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                leadId: { type: "string" },
                                phone: { type: "string" },
                                clinicName: { type: "string" },
                                message: { type: "string" }
                            },
                            required: ["message"]
                        }
                    },

                    {
                        name: "prepare_whatsapp_web_batch",
                        description:
                            "Birden fazla lead için WhatsApp Web sohbetlerini ayrı sekmelerde açar ve mesajları gönderilmeden hazırlar. Kullanıcı son gönderimi kendisi yapar.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                leadIds: { type: "array", items: { type: "string" } },
                                messages: { type: "array", items: { type: "object" } }
                            },
                            required: []
                        }
                    },

                    {
                        name: "prepare_whatsapp_web_all_numbers",
                        description:
                            "Tek bir lead için leads.json içindeki tüm telefon numaralarını WhatsApp Web'de ayrı sekmelerde açar ve aynı kişiselleştirilmiş mesajı her numaraya gönderilmeden hazırlar. Rehbere kayıt yapmaz.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                leadId: { type: "string" },
                                message: { type: "string" }
                            },
                            required: ["leadId", "message"]
                        }
                    },

                    {
                        name: "show_whatsapp_chat",
                        description:
                            "Hazırlanmış WhatsApp Web sohbetini öne getirir. Mesaj göndermez.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                leadId: { type: "string" },
                                phone: { type: "string" }
                            },
                            required: []
                        }
                    },

                    // ----------------------------------
                    // SEND WHATSAPP
                    // ----------------------------------

                    {
                        name: "send_whatsapp_message",

                        description:
                            "Açık ONAYLA sonrası WhatsApp click-to-chat bağlantısı oluşturur. Gerçek API gönderimi yapmaz; kullanıcı WhatsApp ekranında son kez Gönder butonuna basar.",

                        inputSchema: {

                            type: "object",

                            properties: {

                                leadId: {
                                    type: "string",
                                    description: "Leads.json içindeki lead ID. Verilirse telefon otomatik bulunur."
                                },

                                phone: {
                                    type: "string",
                                    description: "Telefon numarası. leadId verilmezse kullanılabilir."
                                },

                                message: {
                                    type: "string",
                                    description: "WhatsApp mesajı."
                                },

                                approval: {
                                    type: "string",
                                    enum: [
                                        "ONAYLA"
                                    ],
                                    description: "Kullanıcının açık onayı."
                                }

                            },

                            required: [
                                "message",
                                "approval"
                            ]
                        }
                    }

                    ,

                    // ----------------------------------
                    // SAVE RESEARCHED LEADS
                    // ----------------------------------

                    {
                        name: "save_researched_leads",
                        description:
                            "Gemini Spark tarafından araştırılan ve doğrulanan işletmeleri otomatik olarak leads.json dosyasına kaydeder. Minimum lead skoru filtresi uygular, aynı klinik/telefon için duplicate oluşturmaz ve mevcut lead'i yeni bilgilerle günceller.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                minScore: {
                                    type: "number",
                                    description: "Kaydedilecek minimum lead skoru. Varsayılan 70."
                                },
                                leads: {
                                    type: "array",
                                    description: "Araştırılmış işletme leadleri.",
                                    items: {
                                        type: "object",
                                        properties: {
                                            clinicName: { type: "string" },
                                            phone: { type: "string" },
                                            phoneNumbers: { type: "array", items: { type: "string" } },
                                            district: { type: "string" },
                                            city: { type: "string" },
                                            website: { type: "string" },
                                            websiteStatus: { type: "string" },
                                            category: { type: "string" },
                                            websiteScore: { type: "number" },
                                            leadScore: { type: "number" },
                                            googleRating: { type: "number" },
                                            googleReviews: { type: "number" },
                                            problem: { type: "string" },
                                            opportunity: { type: "string" },
                                            offer: { type: "string" },
                                            source: { type: "string" },
                                            notes: { type: "string" }
                                        },
                                        required: ["clinicName", "leadScore"]
                                    }
                                }
                            },
                            required: ["leads"]
                        }
                    }

                ]
            };
        }
    );

    // ==================================================
    // TOOL CALL
    // ==================================================

    server.setRequestHandler(
        CallToolRequestSchema,
        async (request) => {

            const {
                name,
                arguments: args = {}
            } = request.params;

            // ==================================================
            // GET STATUS
            // ==================================================

            if (name === "get_status") {

                const leads = await readLeads();

                return {
                    content: [
                        {
                            type: "text",

                            text:
                                "Spark Sales MCP çalışıyor.\n\n" +
                                `Kayıtlı lead sayısı: ${leads.length}`
                        }
                    ]
                };
            }

            // ==================================================
            // GET LEADS
            // ==================================================

            if (name === "get_leads") {

                const leads = await readLeads();

                return {
                    content: [
                        {
                            type: "text",

                            text:
                                leads.length === 0
                                    ? "leads.json şu anda boş."
                                    : JSON.stringify(
                                        leads,
                                        null,
                                        2
                                    )
                        }
                    ]
                };
            }

            // ==================================================
            // ADD LEAD
            // ==================================================

            if (name === "add_lead") {

                const leads = await readLeads();

                const now = new Date().toISOString();

                const lead = {

                    id: randomUUID(),

                    clinicName:
                        args.clinicName || "",

                    phone:
                        args.phone || "",

                    phoneNumbers:
                        Array.isArray(args.phoneNumbers) && args.phoneNumbers.length
                            ? args.phoneNumbers
                            : (args.phone ? [args.phone] : []),

                    district:
                        args.district || "",

                    city:
                        args.city || "",

                    website:
                        args.website || "",

                    websiteStatus:
                        args.websiteStatus || "",

                    category:
                        args.category || "",

                    websiteScore:
                        args.websiteScore ?? null,

                    leadScore:
                        args.leadScore ?? null,

                    googleRating:
                        args.googleRating ?? null,

                    googleReviews:
                        args.googleReviews ?? null,

                    problem:
                        args.problem || "",

                    opportunity:
                        args.opportunity || "",

                    offer:
                        args.offer || "",

                    source:
                        args.source || "Gemini Spark",

                    notes:
                        args.notes || "",

                    status:
                        "NEW",

                    whatsappStatus:
                        "NOT_CONTACTED",

                    createdAt:
                        now,

                    updatedAt:
                        now
                };

                leads.push(lead);

                await writeLeads(leads);

                return {
                    content: [
                        {
                            type: "text",

                            text:
                                "Lead başarıyla kaydedildi.\n\n" +
                                `ID: ${lead.id}\n` +
                                `Müşteri: ${lead.clinicName}\n` +
                                `Toplam lead: ${leads.length}`
                        }
                    ]
                };
            }

            // ==================================================
            // PREPARE WHATSAPP MESSAGE
            // ==================================================

            if (
                name ===
                "prepare_whatsapp_message"
            ) {

                const leads = await readLeads();

                let lead = null;

                if (args.leadId) {
                    lead = leads.find(
                        item => item.id === args.leadId
                    );
                }

                if (!lead && args.clinicName) {
                    lead = leads.find(
                        item =>
                            String(item.clinicName).toLowerCase() ===
                            String(args.clinicName).toLowerCase()
                    );
                }

                const clinicName =
                    lead?.clinicName ||
                    args.clinicName ||
                    "";

                const phone =
                    lead?.phone ||
                    args.phone ||
                    "";

                if (!clinicName) {
                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    "Mesaj hazırlanamadı. Klinik adı bulunamadı."
                            }
                        ]
                    };
                }

                if (!phone) {
                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    `Mesaj hazırlanamadı. ${clinicName} için telefon numarası bulunamadı.`
                            }
                        ]
                    };
                }

                return {
                    content: [
                        {
                            type: "text",

                            text:
                                `Müşteri: ${clinicName}\n` +
                                `Telefon: ${phone}\n\n` +
                                `Hazırlanan mesaj:\n${args.message}\n\n` +
                                `Lead ID: ${lead?.id || "YOK"}\n` +
                                `Durum: ONAY BEKLİYOR\n\n` +
                                `Gönderim için kullanıcı açıkça ONAYLA demelidir.`
                        }
                    ]
                };
            }

            // ==================================================
            // PREPARE WHATSAPP WEB
            // ==================================================

            if (name === "prepare_whatsapp_web") {
                const leads = await readLeads();
                let lead = args.leadId ? leads.find(item => item.id === args.leadId) : null;

                const clinicName = lead?.clinicName || args.clinicName || "";
                const phone = lead?.phone || args.phone || "";

                if (!phone) {
                    return { content: [{ type: "text", text: "WhatsApp Web hazırlanamadı: telefon numarası bulunamadı." }] };
                }

                const result = await prepareWhatsAppPage({
                    leadId: lead?.id || args.leadId || normalizePhone(phone),
                    phone,
                    message: args.message || "",
                    clinicName
                });

                if (lead) {
                    const index = leads.findIndex(item => item.id === lead.id);
                    if (index !== -1) {
                        leads[index].whatsappStatus = "READY_FOR_MANUAL_SEND";
                        leads[index].lastWhatsappMessage = args.message || "";
                        leads[index].lastWhatsappPhone = phone;
                        leads[index].updatedAt = new Date().toISOString();
                        await writeLeads(leads);
                    }
                }

                return {
                    content: [{
                        type: "text",
                        text:
                            `WhatsApp Web hazırlandı.\n\n` +
                            `Müşteri: ${clinicName || "Bilinmiyor"}\n` +
                            `Telefon: ${phone}\n` +
                            `Lead ID: ${lead?.id || args.leadId || "YOK"}\n\n` +
                            `Durum: READY_FOR_MANUAL_SEND\n` +
                            `Mesaj yazıldı fakat GÖNDERİLMEDİ. Kullanıcı WhatsApp Web'deki Gönder butonuna kendisi basmalıdır.`
                    }]
                };
            }

            // ==================================================
            // PREPARE WHATSAPP WEB BATCH
            // ==================================================

            if (name === "prepare_whatsapp_web_batch") {
                const leads = await readLeads();
                let items = Array.isArray(args.messages) ? args.messages : [];

                if (!items.length && Array.isArray(args.leadIds)) {
                    items = args.leadIds.map(leadId => ({ leadId }));
                }

                if (!items.length) {
                    return { content: [{ type: "text", text: "Batch için lead veya mesaj listesi verilmedi." }] };
                }

                const results = [];

                for (const item of items) {
                    const lead = item.leadId ? leads.find(x => x.id === item.leadId) : null;
                    const phone = lead?.phone || item.phone || "";
                    const clinicName = lead?.clinicName || item.clinicName || "";
                    const message = item.message || "";

                    if (!phone || !message) {
                        results.push({ clinicName, phone, status: "SKIPPED_MISSING_PHONE_OR_MESSAGE" });
                        continue;
                    }

                    try {
                        const result = await prepareWhatsAppPage({
                            leadId: lead?.id || item.leadId || normalizePhone(phone),
                            phone,
                            message,
                            clinicName
                        });

                        if (lead) {
                            const index = leads.findIndex(x => x.id === lead.id);
                            if (index !== -1) {
                                leads[index].whatsappStatus = "READY_FOR_MANUAL_SEND";
                                leads[index].lastWhatsappMessage = message;
                                leads[index].lastWhatsappPhone = phone;
                                leads[index].updatedAt = new Date().toISOString();
                            }
                        }

                        results.push({ clinicName, phone, leadId: lead?.id || item.leadId || null, status: result.status });
                    } catch (error) {
                        results.push({ clinicName, phone, status: "ERROR", error: error.message });
                    }
                }

                await writeLeads(leads);

                return {
                    content: [{
                        type: "text",
                        text:
                            "WhatsApp Web batch hazırlandı.\n\n" +
                            JSON.stringify(results, null, 2) +
                            "\n\nHiçbir mesaj gönderilmedi. Her sekmedeki Gönder işlemini kullanıcı yapmalıdır."
                    }]
                };
            }

            // ==================================================
            // PREPARE ALL NUMBERS OF ONE LEAD
            // ==================================================

            if (name === "prepare_whatsapp_web_all_numbers") {
                const leads = await readLeads();
                const lead = leads.find(item => item.id === args.leadId);

                if (!lead) {
                    return { content: [{ type: "text", text: "Lead bulunamadı." }] };
                }

                const phoneNumbers = Array.from(new Set([
                    ...(Array.isArray(lead.phoneNumbers) ? lead.phoneNumbers : []),
                    lead.phone
                ].filter(Boolean)));

                if (!phoneNumbers.length) {
                    return { content: [{ type: "text", text: `${lead.clinicName} için telefon numarası bulunamadı.` }] };
                }

                const results = [];

                for (const phone of phoneNumbers) {
                    try {
                        const result = await prepareWhatsAppPage({
                            leadId: `${lead.id}:${normalizePhone(phone)}`,
                            phone,
                            message: args.message || "",
                            clinicName: lead.clinicName
                        });
                        results.push({ phone, status: result.status });
                    } catch (error) {
                        results.push({ phone, status: "ERROR", error: error.message });
                    }
                }

                const index = leads.findIndex(item => item.id === lead.id);
                if (index !== -1) {
                    leads[index].whatsappStatus = "READY_FOR_MANUAL_SEND";
                    leads[index].lastWhatsappMessage = args.message || "";
                    leads[index].updatedAt = new Date().toISOString();
                    await writeLeads(leads);
                }

                return {
                    content: [{
                        type: "text",
                        text:
                            `WhatsApp Web: ${lead.clinicName} için ${phoneNumbers.length} numara işlendi.\n\n` +
                            JSON.stringify(results, null, 2) +
                            "\n\nMesajların hiçbiri gönderilmedi. Kullanıcı her sohbeti okuyup Gönder butonuna kendisi basmalıdır."
                    }]
                };
            }

            // ==================================================
            // SHOW WHATSAPP CHAT
            // ==================================================

            if (name === "show_whatsapp_chat") {
                const key = args.leadId || normalizePhone(args.phone || "");
                const shown = await showWhatsAppPage(key);

                return {
                    content: [{
                        type: "text",
                        text: shown
                            ? "WhatsApp sohbeti öne getirildi. Mesaj gönderilmedi."
                            : "Hazırlanmış WhatsApp sohbeti bulunamadı."
                    }]
                };
            }

            // ==================================================
            // SEND WHATSAPP MESSAGE
            // ==================================================

            if (
                name ===
                "send_whatsapp_message"
            ) {

                // ------------------------------------------
                // AÇIK ONAY KONTROLÜ
                // ------------------------------------------

                if (
                    args.approval !==
                    "ONAYLA"
                ) {

                    return {
                        content: [
                            {
                                type: "text",

                                text:
                                    "Mesaj gönderilmedi.\n" +
                                    "Açık ONAYLA onayı gerekiyor."
                            }
                        ]
                    };
                }

                const leads = await readLeads();

                let lead = null;

                if (args.leadId) {
                    lead = leads.find(
                        item => item.id === args.leadId
                    );
                }

                const phone =
                    lead?.phone ||
                    args.phone ||
                    "";

                const clinicName =
                    lead?.clinicName ||
                    "";

                if (!phone) {
                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    "WhatsApp bağlantısı oluşturulamadı. Telefon numarası bulunamadı."
                            }
                        ]
                    };
                }

                // Türkiye numaralarını WhatsApp click-to-chat formatına çevir.
                let normalizedPhone =
                    String(phone)
                        .replace(/[^0-9]/g, "");

                if (
                    normalizedPhone.startsWith("0") &&
                    normalizedPhone.length === 11
                ) {
                    normalizedPhone =
                        "90" +
                        normalizedPhone.slice(1);
                }

                if (
                    normalizedPhone.startsWith("90") === false &&
                    normalizedPhone.length === 10
                ) {
                    normalizedPhone =
                        "90" +
                        normalizedPhone;
                }

                const whatsappUrl =
                    `https://wa.me/${normalizedPhone}?text=` +
                    encodeURIComponent(
                        args.message || ""
                    );

                // Burada GERÇEK mesaj gönderilmiyor.
                // Kullanıcı bağlantıyı açıp WhatsApp'ta son kez Gönder'e basıyor.

                if (lead) {
                    const index =
                        leads.findIndex(
                            item => item.id === lead.id
                        );

                    if (index !== -1) {
                        leads[index].whatsappStatus =
                            "APPROVED_WAITING_MANUAL_SEND";

                        leads[index].lastWhatsappMessage =
                            args.message || "";

                        leads[index].updatedAt =
                            new Date().toISOString();

                        await writeLeads(leads);
                    }
                }

                return {
                    content: [
                        {
                            type: "text",

                            text:
                                "ONAY ALINDI.\n\n" +
                                `Müşteri: ${clinicName || "Bilinmiyor"}\n` +
                                `Telefon: ${phone}\n\n` +
                                `WhatsApp bağlantısı hazır:\n${whatsappUrl}\n\n` +
                                "WhatsApp açılacak ve mesaj kutusu doldurulacak. " +
                                "Son gönderme işlemini kullanıcı yapmalıdır.\n\n" +
                                "Durum: APPROVED_WAITING_MANUAL_SEND"
                        }
                    ]
                };
            }

            // ==================================================
            // SAVE RESEARCHED LEADS
            // ==================================================

            if (name === "save_researched_leads") {

                const incomingLeads = Array.isArray(args.leads) ? args.leads : [];
                const minScore = Number(args.minScore ?? 70);

                if (!incomingLeads.length) {
                    return {
                        content: [{ type: "text", text: "Kaydedilecek lead bulunamadı." }]
                    };
                }

                const leads = await readLeads();
                const now = new Date().toISOString();
                let added = 0;
                let updated = 0;
                let skipped = 0;
                const results = [];

                const cleanPhone = (phone) => String(phone || "").replace(/[^0-9]/g, "");
                const cleanName = (name) => String(name || "")
                    .toLocaleLowerCase("tr-TR")
                    .replace(/\s+/g, " ")
                    .trim();

                for (const item of incomingLeads) {
                    const clinicName = String(item.clinicName || "").trim();
                    const leadScore = Number(item.leadScore ?? 0);

                    if (!clinicName) {
                        skipped++;
                        results.push({ status: "SKIPPED", reason: "clinicName eksik" });
                        continue;
                    }

                    if (leadScore < minScore) {
                        skipped++;
                        results.push({ clinicName, leadScore, status: "SKIPPED_LOW_SCORE" });
                        continue;
                    }

                    const phoneNumbers = Array.from(new Set([
                        ...(Array.isArray(item.phoneNumbers) ? item.phoneNumbers : []),
                        item.phone
                    ].filter(Boolean).map(cleanPhone).filter(Boolean)));

                    const existingIndex = leads.findIndex(existing => {
                        if (cleanName(existing.clinicName) === cleanName(clinicName)) return true;
                        const existingPhones = [
                            ...(Array.isArray(existing.phoneNumbers) ? existing.phoneNumbers : []),
                            existing.phone
                        ].filter(Boolean).map(cleanPhone);
                        return phoneNumbers.some(phone => phone && existingPhones.includes(phone));
                    });

                    if (existingIndex !== -1) {
                        const existing = leads[existingIndex];
                        const mergedPhones = Array.from(new Set([
                            ...(Array.isArray(existing.phoneNumbers) ? existing.phoneNumbers : []),
                            existing.phone,
                            ...phoneNumbers
                        ].filter(Boolean)));

                        leads[existingIndex] = {
                            ...existing,
                            phone: existing.phone || phoneNumbers[0] || "",
                            phoneNumbers: mergedPhones,
                            district: item.district || existing.district || "",
                            city: item.city || existing.city || "",
                            website: item.website || existing.website || "",
                            websiteStatus: item.websiteStatus || existing.websiteStatus || "",
                            category: item.category || existing.category || "",
                            websiteScore: item.websiteScore ?? existing.websiteScore ?? null,
                            leadScore: Math.max(Number(existing.leadScore || 0), leadScore),
                            googleRating: item.googleRating ?? existing.googleRating ?? null,
                            googleReviews: item.googleReviews ?? existing.googleReviews ?? null,
                            problem: item.problem || existing.problem || "",
                            opportunity: item.opportunity || existing.opportunity || "",
                            offer: item.offer || existing.offer || "",
                            source: existing.source || item.source || "Gemini Spark",
                            notes: item.notes || existing.notes || "",
                            researchedAt: item.researchedAt || now,
                            updatedAt: now
                        };

                        updated++;
                        results.push({ clinicName, id: existing.id, leadScore: leads[existingIndex].leadScore, status: "UPDATED" });
                        continue;
                    }

                    const numericIds = leads.map(x => Number(x.id)).filter(Number.isFinite);
                    const nextId = numericIds.length ? Math.max(...numericIds) + 1 : 1;

                    const newLead = {
                        id: nextId,
                        clinicName,
                        phone: phoneNumbers[0] || "",
                        phoneNumbers,
                        district: item.district || "",
                        city: item.city || "İstanbul",
                        website: item.website || "",
                        websiteStatus: item.websiteStatus || "",
                        category: item.category || "",
                        websiteScore: item.websiteScore ?? null,
                        leadScore,
                        googleRating: item.googleRating ?? null,
                        googleReviews: item.googleReviews ?? null,
                        problem: item.problem || "",
                        opportunity: item.opportunity || "",
                        offer: item.offer || "",
                        source: item.source || "Gemini Spark",
                        notes: item.notes || "",
                        status: "NEW",
                        whatsappStatus: "NOT_CONTACTED",
                        createdAt: now,
                        updatedAt: now,
                        researchedAt: item.researchedAt || now
                    };

                    leads.push(newLead);
                    added++;
                    results.push({ clinicName, id: newLead.id, leadScore, status: "ADDED" });
                }

                await writeLeads(leads);

                return {
                    content: [{
                        type: "text",
                        text:
                            `Lead araştırma sonucu\n\nYeni eklenen: ${added}\nGüncellenen: ${updated}\nAtlanan: ${skipped}\nToplam lead: ${leads.length}\n\n` +
                            JSON.stringify(results, null, 2)
                    }]
                };
            }

            // ==================================================
            // UNKNOWN TOOL
            // ==================================================

            throw new Error(
                `Bilinmeyen tool: ${name}`
            );
        }
    );

    return server;
}

// ======================================================
// MCP POST
// ======================================================

app.post(
    "/mcp",
    async (req, res) => {

        try {

            const sessionId =
                req.headers[
                    "mcp-session-id"
                ];

            let transport;

            // ==================================================
            // EXISTING SESSION
            // ==================================================

            if (
                sessionId &&
                sessions.has(sessionId)
            ) {

                transport =
                    sessions.get(
                        sessionId
                    );
            }

            // ==================================================
            // NEW SESSION
            // ==================================================

            else if (
                !sessionId &&
                isInitializeRequest(
                    req.body
                )
            ) {

                transport =
                    new StreamableHTTPServerTransport(
                        {
                            sessionIdGenerator:
                                () =>
                                    randomUUID(),

                            onsessioninitialized:
                                (
                                    newSessionId
                                ) => {

                                    sessions.set(
                                        newSessionId,
                                        transport
                                    );

                                    console.log(
                                        `[MCP] Yeni session: ${newSessionId}`
                                    );
                                }
                        }
                    );

                transport.onclose =
                    () => {

                        if (
                            transport.sessionId
                        ) {

                            sessions.delete(
                                transport.sessionId
                            );

                            console.log(
                                `[MCP] Session kapandı: ${transport.sessionId}`
                            );
                        }
                    };

                const server =
                    createMcpServer();

                await server.connect(
                    transport
                );
            }

            // ==================================================
            // INVALID SESSION
            // ==================================================

            else if (sessionId) {

                res.status(404).json({

                    jsonrpc: "2.0",

                    error: {

                        code: -32001,

                        message:
                            "MCP session bulunamadı."
                    },

                    id: null
                });

                return;
            }

            // ==================================================
            // INVALID REQUEST
            // ==================================================

            else {

                res.status(400).json({

                    jsonrpc: "2.0",

                    error: {

                        code: -32000,

                        message:
                            "Geçersiz MCP isteği. Initialize isteği gerekli."
                    },

                    id: null
                });

                return;
            }

            // ==================================================
            // HANDLE REQUEST
            // ==================================================

            await transport.handleRequest(
                req,
                res,
                req.body
            );

        } catch (error) {

            console.error(
                "[MCP ERROR]",
                error
            );

            if (
                !res.headersSent
            ) {

                res.status(500).json({

                    jsonrpc: "2.0",

                    error: {

                        code: -32603,

                        message:
                            "Internal server error"
                    },

                    id: null
                });
            }
        }
    }
);

// ======================================================
// MCP GET
// ======================================================

app.get(
    "/mcp",
    async (req, res) => {

        const sessionId =
            req.headers[
                "mcp-session-id"
            ];

        if (
            !sessionId ||
            !sessions.has(sessionId)
        ) {

            res.status(400).json({

                error:
                    "Geçerli MCP session gerekli."
            });

            return;
        }

        const transport =
            sessions.get(
                sessionId
            );

        try {

            await transport.handleRequest(
                req,
                res
            );

        } catch (error) {

            console.error(
                "[MCP GET ERROR]",
                error
            );

            if (
                !res.headersSent
            ) {

                res.status(500).end();
            }
        }
    }
);

// ======================================================
// MCP DELETE
// ======================================================

app.delete(
    "/mcp",
    async (req, res) => {

        const sessionId =
            req.headers[
                "mcp-session-id"
            ];

        if (
            !sessionId ||
            !sessions.has(sessionId)
        ) {

            res.status(404).json({

                error:
                    "MCP session bulunamadı."
            });

            return;
        }

        const transport =
            sessions.get(
                sessionId
            );

        try {

            await transport.handleRequest(
                req,
                res
            );

        } catch (error) {

            console.error(
                "[MCP DELETE ERROR]",
                error
            );

            if (
                !res.headersSent
            ) {

                res.status(500).end();
            }
        }
    }
);

// ======================================================
// LOCAL WHATSAPP APPROVAL PANEL
// ======================================================

app.get("/whatsapp", async (req, res) => {
    const items = Array.from(whatsappQueue.entries()).map(([key, value]) => ({ key, ...value }));

    const rows = items.map(item => `
        <div class="card">
            <div class="title">${escapeHtml(item.clinicName || "Lead")}</div>
            <div class="phone">${escapeHtml(item.phone || item.normalizedPhone)}</div>
            <div class="status">${escapeHtml(item.status)}</div>
            <pre>${escapeHtml(item.message || "")}</pre>
            <button onclick="showChat(${JSON.stringify(item.key)})">WhatsApp'ı Göster</button>
        </div>
    `).join("");

    res.type("html").send(`<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta http-equiv="refresh" content="5"><title>Spark WhatsApp Onay</title>
<style>body{font-family:Arial,sans-serif;background:#111;color:#eee;margin:0;padding:24px}.wrap{max-width:1000px;margin:auto}.card{background:#1b1b1b;border:1px solid #333;border-radius:14px;padding:18px;margin:14px 0}.title{font-size:20px;font-weight:700}.phone,.status{margin-top:7px;color:#aaa}pre{white-space:pre-wrap;background:#101010;padding:14px;border-radius:10px;line-height:1.5}button{padding:11px 16px;border:0;border-radius:8px;cursor:pointer;font-weight:700}h1{margin-top:0}</style>
<script>async function showChat(key){await fetch('/whatsapp/show?key='+encodeURIComponent(key),{method:'POST'});}</script></head>
<body><div class="wrap"><h1>WhatsApp Hazırlanan Mesajlar</h1><p>Mesajlar otomatik gönderilmez. Kontrol edip WhatsApp Web'deki Gönder butonuna sen basarsın.</p>${rows || "<p>Hazırlanmış sohbet yok.</p>"}</div></body></html>`);
});

app.post("/whatsapp/show", async (req, res) => {
    const key = String(req.query.key || "");
    const shown = await showWhatsAppPage(key);
    res.json({ ok: shown });
});

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
    "/",
    async (req, res) => {

        const leads =
            await readLeads();

        res.json({

            name:
                "Spark Sales MCP",

            status:
                "online",

            transport:
                "Streamable HTTP",

            endpoint:
                "/mcp",

            port:
                PORT,

            leads:
                leads.length,

            whatsappPanel:
                `http://127.0.0.1:${PORT}/whatsapp`
        });
    }
);

// ======================================================
// START SERVER
// ======================================================

await ensureLeadsFile();

app.listen(
    PORT,
    "127.0.0.1",
    () => {

        console.log("");

        console.log(
            "======================================"
        );

        console.log(
            "       SPARK SALES MCP SERVER"
        );

        console.log(
            "======================================"
        );

        console.log("");

        console.log(
            `Server : http://127.0.0.1:${PORT}`
        );

        console.log(
            `MCP    : http://127.0.0.1:${PORT}/mcp`
        );

        console.log("");

        console.log(
            "Leads  : leads.json"
        );

        console.log("");

        console.log(
            "Durum  : ÇALIŞIYOR"
        );

        console.log("");
    }
);