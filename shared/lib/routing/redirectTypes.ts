/**
 * Type definitions for the centralized redirect system
 */

export type RedirectSource = 
  | 'owner' 
  | 'prospect' 
  | 'oauth' 
  | 'login' 
  | 'signup' 
  | 'root';

export interface RedirectContext {
  userId: string;
  source?: RedirectSource;
  profile?: {
    roles: string[];
    username?: string | null;
  };
  pendingOwnerSession?: boolean;
  pendingProspectSession?: boolean;
  ownerProfileCompletionTriggered?: boolean;
  prospectProfileCompletionTriggered?: boolean;
  existingOwnerConversation?: boolean;
  existingProspectConversation?: boolean;
  isNewUser?: boolean;
  isFacebookLogin?: boolean;
  fromOwner?: boolean;
  fromOwnerV2?: boolean;
  fromProspect?: boolean;
}

export interface RedirectResult {
  path: string;
  reason: string;
  priority: number;
  queryParams?: Record<string, string>;
}
