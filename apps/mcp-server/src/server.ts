import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js';

export type ToolHandler = {
  tool: Tool;
  handler: (args: any) => Promise<any>;
};

export class SparkMcpServer {
  public server: Server;
  private tools: Map<string, ToolHandler> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: 'spark-sales-mcp',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  public registerTool(handler: ToolHandler) {
    this.tools.set(handler.tool.name, handler);
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Array.from(this.tools.values()).map(h => h.tool),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const handler = this.tools.get(name);
      
      if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        return await handler.handler(args);
      } catch (error: any) {
        let errorMessage = error.message || 'Unknown error occurred';
        
        if (error.name === 'ZodError' && Array.isArray(error.errors)) {
          errorMessage = `Validation Error: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
        } else if (error.name === 'ZodError' && Array.isArray(error.issues)) {
          errorMessage = `Validation Error: ${error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
        } else if (error.code && error.code.startsWith('P')) {
          errorMessage = `Database Error: Operation failed (${error.code})`;
        } else if (error.name === 'PrismaClientValidationError') {
          errorMessage = 'Database Validation Error: Invalid request format';
        } else if (errorMessage.toLowerCase().includes('prisma')) {
          errorMessage = 'Internal Database Error';
        }

        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }
}
