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

async function main() {
  const app = express();
  const port = Number(process.env.PORT) || 3001;

  // Global CORS & SSE Headers (Gemini entegrasyonu icin zorunlu)
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

  const mcpApp = new SparkMcpServer();

  // Register tools
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

  let transport: SSEServerTransport | null = null;

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: 'spark-mcp' });
  });

  app.get('/', (_req, res) => {
    res.json({ status: 'ok', message: 'Spark MCP SSE server is running' });
  });

  app.get('/sse', async (req, res) => {
    console.log('SSE connection requested from:', req.headers['origin'] || req.ip);
    transport = new SSEServerTransport('/messages', res);
    await mcpApp.server.connect(transport);

    req.on('close', () => {
      console.log('SSE connection closed');
    });
  });

  app.post('/messages', async (req, res) => {
    if (!transport) {
      res.status(400).send('No active SSE session');
      return;
    }
    await transport.handlePostMessage(req, res);
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