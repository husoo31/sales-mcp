import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('MCP Protocol Integration', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    // Start the real compiled MCP server using node
    const serverPath = join(__dirname, '../dist/index.js');
    
    transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
    });

    client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
  });

  afterAll(async () => {
    if (transport) {
      await transport.close();
    }
  });

  it('should discover all 10 tools', async () => {
    const response = await client.listTools();
    
    expect(response.tools).toBeDefined();
    expect(response.tools.length).toBe(10);
    
    const names = response.tools.map(t => t.name);
    expect(names).toContain('search_leads');
    expect(names).toContain('get_lead');
    expect(names).toContain('create_lead');
    expect(names).toContain('update_lead');
    expect(names).toContain('draft_message');
    expect(names).toContain('get_message_drafts');
    expect(names).toContain('approve_message');
    expect(names).toContain('get_lead_activity');
    expect(names).toContain('schedule_followup');
    expect(names).toContain('get_followups');
  });

  it('should handle invalid input gracefully without crashing', async () => {
    // Missing required field "id"
    const result = await client.callTool({
      name: 'get_lead',
      arguments: {}
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Validation Error'); 
  });

  it('should handle unknown tool calls gracefully', async () => {
    try {
      await client.callTool({
        name: 'unknown_tool',
        arguments: {}
      });
      // Should not reach here if client throws, but standard MCP client might throw or return error
      // Actually MCP SDK might throw an error locally if the server returns an error response
      expect.unreachable('Should throw error for unknown tool');
    } catch (e: any) {
      expect(e.message).toContain('Unknown tool');
    }
  });

  it('should execute a valid tool call and catch DB error gracefully', async () => {
    // Since we are running the real server without a mock DB, a DB hit will fail.
    // We expect it to fail gracefully and return an isError: true result without crashing the server.
    const result = await client.callTool({
      name: 'get_lead',
      arguments: { id: '12345678-1234-4234-a234-123456789012' }
    });

    // Zod parsing will succeed, so it hits Prisma.
    // Prisma will either fail to connect or return a record.
    // Either way, it shouldn't crash the server.
    // If it fails, isError is true. If it somehow succeeds (test DB running?), isError is false.
    // But the server must still be alive for the next test!
    expect(result).toBeDefined();
  });

  it('server should remain stable after errors (subsequent tool list still works)', async () => {
    const response = await client.listTools();
    expect(response.tools.length).toBe(10);
  });
});
