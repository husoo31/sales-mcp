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

  const sessions = new Map<string, { transport: SSEServerTransport; mcpApp: SparkMcpServer }>();

  // Kapsamlı CORS başlıkları (Gemini proxy'lerinin takılmaması için)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
    res.header('Access-Control-Expose-Headers', '*');
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

  // Ortak SSE dinleyici fonksiyonu
  const handleSse = async (req: express.Request, res: express.Response) => {
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (res.flushHeaders) {
      res.flushHeaders();
    }

    const transport = new SSEServerTransport('/messages', res);
    const mcpApp = createSparkMcpInstance();

    const sessionId = transport.sessionId;
    sessions.set(sessionId, { transport, mcpApp });

    req.on('close', async () => {
      sessions.delete(sessionId);
      try {
        await mcpApp.server.close();
      } catch (err) {
        console.error('Error closing server instance:', err);
      }
    });

    await mcpApp.server.connect(transport);
  };

  // Hem /sse hem / rotasını dinle
  app.get('/sse', handleSse);

  // Ortak Mesaj iletici fonksiyonu (hem /messages hem /message destekler)
  const handleMessage = async (req: express.Request, res: express.Response) => {
    const sessionId = req.query.sessionId as string;
    const session = sessions.get(sessionId);

    if (!session) {
      res.status(404).json({ error: 'Session not found or expired' });
      return;
    }

    await session.transport.handlePostMessage(req, res);
  };

  app.post('/messages', handleMessage);
  app.post('/message', handleMessage);

  app.listen(port, '0.0.0.0', () => {
    console.log(`Spark Sales MCP Server running on port ${port}`);
  });
}

main().catch(async (error) => {
  console.error('Server error:', error);
  await prisma.$disconnect();
  process.exit(1);
});