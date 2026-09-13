import express from 'express';
import { prisma } from '@spark/database';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { SparkMcpServer } from './server.js';
import { leadTools } from './tools/lead.tools.js';
import { messageTools } from './tools/message.tools.js';
import { activityTools } from './tools/activity.tools.js';
import { followUpTools } from './tools/followup.tools.js';
import { aiTools } from './tools/ai.tools.js';
import { scanTools } from './tools/scan.tools.js';

// Her yeni bağlantı için izole bir MCP sunucusu üreten fabrika fonksiyonu
function createSparkMcpInstance(): SparkMcpServer {
  const mcpApp = new SparkMcpServer();

  const allTools = [
    ...leadTools,
    ...messageTools,
    ...activityTools,
    ...followUpTools,
    ...aiTools,
    ...scanTools,
  ];

  for (const tool of allTools) {
    mcpApp.registerTool(tool);
  }

  return mcpApp;
}

async function main() {
  const app = express();
  const port = Number(process.env.PORT) || 3001;

  // Çoklu istemci oturumlarını tutan Session Map
  const sessions = new Map<string, { transport: SSEServerTransport; mcpApp: SparkMcpServer }>();

  // Global CORS ayarları
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: 'spark-mcp' });
  });

  app.get('/', (_req, res) => {
    res.json({ status: 'ok', message: 'Spark MCP SSE server is running' });
  });

  app.get('/sse', async (req, res) => {
    // Traefik ve Nginx proxy buffering'ini kapat
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (res.flushHeaders) {
      res.flushHeaders();
    }

    console.log('SSE connection requested from:', req.headers['origin'] || req.ip);

    // Her oturuma özel transport ve mcp sunucu örneği oluştur
    const transport = new SSEServerTransport('/messages', res);
    const mcpApp = createSparkMcpInstance();

    const sessionId = transport.sessionId;
    sessions.set(sessionId, { transport, mcpApp });

    req.on('close', async () => {
      console.log(`SSE connection closed for session: ${sessionId}`);
      sessions.delete(sessionId);
      try {
        await mcpApp.server.close();
      } catch (err) {
        console.error('Error closing MCP server instance:', err);
      }
    });

    await mcpApp.server.connect(transport);
  });

  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const session = sessions.get(sessionId);

    if (!session) {
      res.status(404).json({ error: 'Session not found or expired' });
      return;
    }

    await session.transport.handlePostMessage(req, res);
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`Spark Sales MCP Server running on port ${port} (SSE mode)`);
  });
}

main().catch(async (error) => {
  console.error('Server error:', error);
  await prisma.$disconnect();
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.error('Received SIGINT, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});