// app/types/market.ts

export interface MarketData {
  timestamp: string;
  security: string;
  last_price: number;
  prev_close: number;
  change_pct: number;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  type?: string;
}

export interface ChartData {
  timestamp: Date;
  change_pct: number;
}

export interface SecurityInfo {
  code: string;
  name: string;
  type: 'equity' | 'currency' | 'index';
}

export interface WebSocketMessage {
  action: 'subscribe' | 'unsubscribe';
  securities: string[];
}

export interface WebSocketResponse {
  type: 'subscription_confirmed' | 'data' | 'error';
  securities?: string[];
  data?: MarketData;
  error?: string;
}