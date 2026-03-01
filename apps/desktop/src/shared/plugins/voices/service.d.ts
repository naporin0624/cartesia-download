export interface VoiceEntry {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  language: string;
  createdAt: string;
}

export interface VoiceUpdateInput {
  name: string;
  description: string;
  isPublic: boolean;
}

export interface VoicesService {
  list(): Promise<VoiceEntry[]>;
  update(id: string, input: VoiceUpdateInput): Promise<void>;
}
