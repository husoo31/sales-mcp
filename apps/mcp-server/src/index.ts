import { prisma } from '@spark/database';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SparkMcpServer } from './server.js';
import { leadTools } from './tools/lead.tools.js';
import { messageTools } from './tools/message.tools.js';
import { activityTools } from './tools/activity.tools.js';
import { followUpTools } from './tools/followup.tools.js';
import { aiTools } from './tools/ai.tools.js';

async function main() {
  const app = new SparkMcpServer();

  // Register tools
  const allTools = [
    ...leadTools,
    ...messageTools,
    ...activityTools,
    ...followUpTools,
    ...aiTools
  ];

  for (const tool of allTools) {
    app.registerTool(tool);
  }

  const transport = new StdioServerTransport();
  await app.server.connect(transport);
  console.error('Spark Sales MCP Server running on stdio');
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
