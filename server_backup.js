import express from "express";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

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

app.use(express.json());

const sessions = new Map();


// ======================================================
// LEADS
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
    // TOOLS
    // ==================================================

    server.setRequestHandler(
        ListToolsRequestSchema,
        async () => {

            return {
                tools: [

                    {
                        name: "get_status",

                        description:
                            "Spark Sales MCP sunucusunun durumunu kontrol eder.",

                        inputSchema: {
                            type: "object",
                            properties: {}
                        }
                    },


                    {
                        name: "get_leads",

                        description:
                            "leads.json içindeki tüm müşteri adaylarını getirir.",

                        inputSchema: {
                            type: "object",
                            properties: {}
                        }
                    },


                    {
                        name: "add_lead",

                        description:
                            "Yeni müşteri adayını leads.json dosyasına kaydeder.",

                        inputSchema: {

                            type: "object",

                            properties: {

                                clinicName: {
                                    type: "string"
                                },

                                phone: {
                                    type: "string"
                                },

                                district: {
                                    type: "string"
                                },

                                city: {
                                    type: "string"
                                },

                                website: {
                                    type: "string"
                                },

                                websiteStatus: {
                                    type: "string"
                                },

                                category: {
                                    type: "string"
                                },

                                websiteScore: {
                                    type: "number"
                                },

                                leadScore: {
                                    type: "number"
                                },

                                googleRating: {
                                    type: "number"
                                },

                                googleReviews: {
                                    type: "number"
                                },

                                problem: {
                                    type: "string"
                                },

                                opportunity: {
                                    type: "string"
                                },

                                offer: {
                                    type: "string"
                                },

                                source: {
                                    type: "string"
                                },

                                notes: {
                                    type: "string"
                                }

                            },

                            required: [
                                "clinicName"
                            ]
                        }
                    },


                    // ==================================================
                    // PREPARE WHATSAPP
                    // ==================================================

                    {
                        name: "prepare_whatsapp_message",

                        description:
                            "Lead için WhatsApp mesajını hazırlar. Lead ID verilirse telefon numarasını otomatik bulur. Mesaj göndermez ve kullanıcı onayı bekler.",

                        inputSchema: {

                            type: "object",

                            properties: {

                                leadId: {
                                    type: "string",
                                    description:
                                        "leads.json içindeki lead ID."
                                },

                                clinicName: {
                                    type: "string",
                                    description:
                                        "Klinik adı."
                                },

                                phone: {
                                    type: "string",
                                    description:
                                        "Telefon numarası."
                                },

                                message: {
                                    type: "string",
                                    description:
                                        "Kişiselleştirilmiş WhatsApp mesajı."
                                }

                            },

                            required: [
                                "message"
                            ]
                        }
                    },


                    // ==================================================
                    // SEND WHATSAPP
                    // ==================================================

                    {
                        name: "send_whatsapp_message",

                        description:
                            "Kullanıcının açık ONAYLA onayından sonra WhatsApp click-to-chat bağlantısı oluşturur. Gerçek API gönderimi yapmaz; kullanıcı WhatsApp'ta son Gönder butonuna basar.",

                        inputSchema: {

                            type: "object",

                            properties: {

                                leadId: {
                                    type: "string",
                                    description:
                                        "leads.json içindeki lead ID."
                                },

                                phone: {
                                    type: "string",
                                    description:
                                        "Telefon numarası."
                                },

                                message: {
                                    type: "string",
                                    description:
                                        "WhatsApp mesajı."
                                },

                                approval: {
                                    type: "string",
                                    enum: [
                                        "ONAYLA"
                                    ],
                                    description:
                                        "Kullanıcının açık onayı."
                                }

                            },

                            required: [
                                "message",
                                "approval"
                            ]
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
            // PREPARE WHATSAPP
            // ==================================================

            if (
                name ===
                "prepare_whatsapp_message"
            ) {

                const leads = await readLeads();

                let lead = null;


                if (args.leadId) {

                    lead = leads.find(
                        item =>
                            item.id === args.leadId
                    );
                }


                if (
                    !lead &&
                    args.clinicName
                ) {

                    lead = leads.find(
                        item =>
                            String(item.clinicName)
                                .toLowerCase() ===
                            String(args.clinicName)
                                .toLowerCase()
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
            // SEND WHATSAPP
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


                const leads =
                    await readLeads();


                let lead = null;


                if (args.leadId) {

                    lead = leads.find(
                        item =>
                            item.id ===
                            args.leadId
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


                // ------------------------------------------
                // TELEFON NUMARASINI NORMALLEŞTİR
                // ------------------------------------------

                let normalizedPhone =
                    String(phone)
                        .replace(
                            /[^0-9]/g,
                            ""
                        );


                if (
                    normalizedPhone.startsWith("0") &&
                    normalizedPhone.length === 11
                ) {

                    normalizedPhone =
                        "90" +
                        normalizedPhone.slice(1);
                }


                if (
                    !normalizedPhone.startsWith("90") &&
                    normalizedPhone.length === 10
                ) {

                    normalizedPhone =
                        "90" +
                        normalizedPhone;
                }


                // ------------------------------------------
                // WHATSAPP LINK
                // ------------------------------------------

                const whatsappUrl =
                    `https://wa.me/${normalizedPhone}?text=` +
                    encodeURIComponent(
                        args.message || ""
                    );


                // ------------------------------------------
                // LEAD DURUMUNU GÜNCELLE
                // ------------------------------------------

                if (lead) {

                    const index =
                        leads.findIndex(
                            item =>
                                item.id ===
                                lead.id
                        );


                    if (index !== -1) {

                        leads[index].whatsappStatus =
                            "APPROVED_WAITING_MANUAL_SEND";

                        leads[index].lastWhatsappMessage =
                            args.message || "";

                        leads[index].updatedAt =
                            new Date().toISOString();

                        await writeLeads(
                            leads
                        );
                    }
                }


                // ------------------------------------------
                // SONUÇ
                // ------------------------------------------

                return {
                    content: [
                        {
                            type: "text",

                            text:
                                "ONAY ALINDI.\n\n" +
                                `Müşteri: ${clinicName || "Bilinmiyor"}\n` +
                                `Telefon: ${phone}\n\n` +
                                `WhatsApp bağlantısı hazır:\n${whatsappUrl}\n\n` +
                                "WhatsApp açılacak ve mesaj kutusu doldurulacak.\n" +
                                "Son gönderme işlemini kullanıcı yapmalıdır.\n\n" +
                                "Durum: APPROVED_WAITING_MANUAL_SEND"
                        }
                    ]
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


            // EXISTING SESSION

            if (
                sessionId &&
                sessions.has(sessionId)
            ) {

                transport =
                    sessions.get(
                        sessionId
                    );
            }


            // NEW SESSION

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


            // INVALID SESSION

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


            // INVALID REQUEST

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
                leads.length
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