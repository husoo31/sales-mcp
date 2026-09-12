import { describe, it, expect } from 'vitest';
import { leadTools } from '../src/tools/lead.tools.js';
import { messageTools } from '../src/tools/message.tools.js';
import { activityTools } from '../src/tools/activity.tools.js';
import { followUpTools } from '../src/tools/followup.tools.js';

describe('MCP Registration Tools', () => {
  it('should export all expected tools without duplicates', () => {
    const allTools = [
      ...leadTools,
      ...messageTools,
      ...activityTools,
      ...followUpTools
    ];

    const names = allTools.map(t => t.tool.name);
    
    // Check expected tool names
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

    // Check for duplicates
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
    expect(names.length).toBe(10);
  });
});
