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

  // Global CORS & JSON-RPC Preflight
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, mcp-session-id');
    res.header('Access-Control-Expose-Headers', '*');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: 'spark-mcp' });
  });

  // SSE Handler
  const handleSse = async (req: express.Request, res: express.Response) => {
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
  };

  app.get('/sse', handleSse);
  app.get('/mcp', handleSse);

  // Message Handler (Gemini'nin hem /messages hem / hem /mcp POST çağrılarını karşılar)
  const handleMessages = async (req: express.Request, res: express.Response) => {
    const sessionId = (req.query.sessionId as string) || (req.headers['mcp-session-id'] as string);

    // Eğer doğrudan JSON-RPC initialize gelirse (SSE oturumsuz stateless HTTP)
    if (!sessionId) {
      const singleServer = createSparkMcpInstance();
      try {
        // Tek seferlik JSON-RPC mesajını sunucuya işlet
        if (req.body && req.body.method === 'initialize') {
          return res.json({
            jsonrpc: '2.0',
            id: req.body.id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: { name: 'spark-sales-mcp', version: '1.0.0' }
            }
          });
        }
      } catch (err) {
        console.error('Stateless MCP error:', err);
      }
      return res.status(400).json({ error: 'Session ID required' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    await session.transport.handlePostMessage(req, res);
  };

  app.post('/messages', handleMessages);
  app.post('/mcp', handleMessages);
  app.post('/', handleMessages);

  // Kök endpoint kontrolü
  app.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      message: 'Spark MCP Server is running',
      endpoints: {
        sse: 'https://mcp.swenzy.blog/sse',
        mcp: 'https://mcp.swenzy.blog/mcp'
      }
    });
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`Spark Sales MCP Server running on port ${port}`);
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