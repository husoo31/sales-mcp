export type LeadStatus = 'NEW' | 'RESEARCHING' | 'ANALYZED' | 'MESSAGE_READY' | 'WAITING_APPROVAL' | 'CONTACTED' | 'REPLIED' | 'INTERESTED' | 'MEETING' | 'PROPOSAL' | 'WON' | 'LOST' | 'WAITING_FOLLOWUP';
export type MessageDraftStatus = 'WAITING_APPROVAL' | 'APPROVED_MANUAL_SEND_PENDING' | 'SENT' | 'REJECTED';
export type ApprovalStatus = 'WAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type FollowUpStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';
export type ConversationStatus = 'OPEN' | 'CLOSED' | 'ARCHIVED';
export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type AuditLogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lead {
  id: string;
  clinicName: string;
  district?: string;
  city?: string;
  rating?: number;
  reviews?: number;
  website?: string;
  phone: string;
  phoneNumbers: string[];
  category?: string;
  leadScore?: number;
  problem?: string;
  opportunity?: string;
  offer?: string;
  source?: string;
  notes?: string;
  status: LeadStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadContact {
  id: string;
  leadId: string;
  name?: string;
  title?: string;
  phone?: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  leadId: string;
  status: ConversationStatus;
  startedAt: Date;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  content: string;
  sender?: string;
  timestamp: Date;
}

export interface MessageDraft {
  id: string;
  leadId: string;
  content: string;
  status: MessageDraftStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Approval {
  id: string;
  draftId: string;
  status: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: Date;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FollowUp {
  id: string;
  leadId: string;
  conversationId?: string;
  scheduledFor: Date;
  status: FollowUpStatus;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityLog {
  id: string;
  leadId?: string;
  action: string;
  details?: string;
  status: string;
  timestamp: Date;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: string;
  level: AuditLogLevel;
  ipAddress?: string;
  createdAt: Date;
}

export interface CommercialGuideline {
  id: string;
  serviceName: string;
  minPrice: number;
  maxPrice: number;
  currency: string;
  allowedDiscountPercentage: number;
  notes?: string;
}
