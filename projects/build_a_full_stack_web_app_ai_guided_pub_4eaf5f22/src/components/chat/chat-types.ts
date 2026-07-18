export type Phase = 'search' | 'intake' | 'done';

export interface ChatMsg {
  id: string;
  role: 'bot' | 'user';
  text: string;
  attachment?: {
    type: 'procedure_card' | 'supported_procedures';
    procedure?: {
      code: string;
      name: string;
      confidence: number;
      sourceUrl?: string;
    };
    procedures?: { code: string; name: string }[];
    originalMessage?: string;
  };
}

export interface Question {
  questionCode: string;
  label: string;
  fieldType: 'radio' | 'select' | 'province' | 'text';
  options?: { value: string; label: string }[];
}

export interface Flow {
  next: Question | null;
  answered: number;
  total: number;
}
