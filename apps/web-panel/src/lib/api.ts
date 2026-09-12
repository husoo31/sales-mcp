export const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface LeadContact {
  id: string;
  name: string | null;
  title: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export interface Lead {
  id: string;
  clinicName: string;
  district?: string;
  city?: string;
  category?: string;
  rating?: number;
  reviews?: number;
  website?: string;
  phone: string;
  leadScore?: number;
  problem?: string;
  opportunity?: string;
  offer?: string;
  notes?: string;
  status: string;
  followUpStatus?: string;
  scheduledFollowUpAt?: string;
  followUpCount?: number;
  drafts?: { screenshotUrl?: string }[];
  createdAt: string;
  contacts?: LeadContact[];
}

export interface MessageDraft {
  id: string;
  leadId: string;
  content: string;
  screenshotUrl?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lead?: Lead;
}

export interface FollowUp {
  id: string;
  leadId: string;
  lead?: Lead;
  scheduledFor: string;
  status: string;
  reason: string | null;
}

export async function getLeads(params?: { status?: string; district?: string; search?: string }): Promise<Lead[]> {
  try {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.district) query.append('district', params.district);
    if (params?.search) query.append('search', params.search);
    
    const res = await fetch(`${BASE_URL}/leads?${query.toString()}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status} - ${res.statusText}`);
    return await res.json();
  } catch (error) {
    console.error('getLeads - Error fetching leads:', error);
    throw error;
  }
}

export async function getLeadById(id: string): Promise<Lead> {
  try {
    const res = await fetch(`${BASE_URL}/leads/${id}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status} - ${res.statusText}`);
    return await res.json();
  } catch (error) {
    console.error(`getLeadById - Error fetching lead ${id}:`, error);
    throw error;
  }
}

export async function getApprovals(): Promise<MessageDraft[]> {
  try {
    const res = await fetch(`${BASE_URL}/approvals`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status} - ${res.statusText}`);
    return await res.json();
  } catch (error) {
    console.error('getApprovals - Error fetching approvals:', error);
    throw error;
  }
}

export async function approveMessage(id: string) {
  try {
    const res = await fetch(`${BASE_URL}/approvals/${id}/approve`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status} - ${res.statusText}`);
    return await res.json();
  } catch (error) {
    console.error(`approveMessage - Error approving message ${id}:`, error);
    throw error;
  }
}

export async function rejectMessage(id: string) {
  try {
    const res = await fetch(`${BASE_URL}/approvals/${id}/reject`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status} - ${res.statusText}`);
    return await res.json();
  } catch (error) {
    console.error(`rejectMessage - Error rejecting message ${id}:`, error);
    throw error;
  }
}

export async function updateDraft(id: string, content: string) {
  try {
    const res = await fetch(`${BASE_URL}/approvals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status} - ${res.statusText}`);
    return await res.json();
  } catch (error) {
    console.error(`updateDraft - Error updating draft ${id}:`, error);
    throw error;
  }
}

export async function getFollowups(): Promise<Lead[]> {
  try {
    const res = await fetch(`${BASE_URL}/followups`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status} - ${res.statusText}`);
    return await res.json();
  } catch (error) {
    console.error('getFollowups - Error fetching followups:', error);
    throw error;
  }
}

export async function createFollowupDraft(leadId: string) {
  try {
    const res = await fetch(`${BASE_URL}/followups/${leadId}/draft`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status} - ${res.statusText}`);
    return await res.json();
  } catch (error) {
    console.error(`createFollowupDraft - Error creating draft for ${leadId}:`, error);
    throw error;
  }
}
