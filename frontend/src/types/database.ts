/**
 * @fileoverview Supabase 数据库类型定义
 * @description 定义数据库表结构和类型
 * @module types/database
 */

export interface Database {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string;
          fund_code: string;
          fund_name: string;
          type: 'buy' | 'sell';
          shares: number;
          nav: number;
          amount: number;
          fee: number;
          date: string;
          status: 'pending' | 'completed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          fund_code: string;
          fund_name: string;
          type: 'buy' | 'sell';
          shares: number;
          nav: number;
          amount: number;
          fee: number;
          date: string;
          status: 'pending' | 'completed';
        };
        Update: {
          fund_code?: string;
          fund_name?: string;
          type?: 'buy' | 'sell';
          shares?: number;
          nav?: number;
          amount?: number;
          fee?: number;
          date?: string;
          status?: 'pending' | 'completed';
        };
      };
      holdings: {
        Row: {
          id: string;
          fund_code: string;
          fund_name: string;
          shares: number;
          avg_nav: number;
          total_cost: number;
          current_nav: number | null;
          market_value: number | null;
          profit: number | null;
          profit_rate: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          fund_code: string;
          fund_name: string;
          shares: number;
          avg_nav: number;
          total_cost: number;
        };
        Update: {
          fund_code?: string;
          fund_name?: string;
          shares?: number;
          avg_nav?: number;
          total_cost?: number;
          current_nav?: number | null;
          market_value?: number | null;
          profit?: number | null;
          profit_rate?: number | null;
        };
      };
      favorite_funds: {
        Row: {
          id: string;
          fund_code: string;
          fund_name: string;
          category: string | null;
          created_at: string;
        };
        Insert: {
          fund_code: string;
          fund_name: string;
          category?: string | null;
        };
        Update: {
          fund_code?: string;
          fund_name?: string;
          category?: string | null;
        };
      };
    };
  };
}
