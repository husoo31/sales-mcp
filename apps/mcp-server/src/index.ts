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

  // Global CORS
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

  // SSE Endpoint
  app.get('/sse', async (req, res) => {
    res.setHeader('X-Accel-Buffering', 'no');

    const transport = new SSEServerTransport('https://mcp.swenzy.blog/messages', res);
    const mcpApp = createSparkMcpInstance();

    const sessionId = transport.sessionId;
    sessions.set(sessionId, { transport, mcpApp });

    req.on('close', async () => {
      sessions.delete(sessionId);
      try {
        await mcpApp.server.close();
      } catch (err) {
        // Oturum kapandı
      }
    });

    await mcpApp.server.connect(transport);
  });

  // Messages Endpoint
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

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});