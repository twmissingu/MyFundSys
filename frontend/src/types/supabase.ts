export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      funds: {
        Row: {
          id: string
          code: string
          name: string
          category: string
          nav: number | null
          nav_date: string | null
          pe: number | null
          pb: number | null
          dividend_yield: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          code: string
          name: string
          category: string
          nav?: number | null
          nav_date?: string | null
          pe?: number | null
          pb?: number | null
          dividend_yield?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          category?: string
          nav?: number | null
          nav_date?: string | null
          pe?: number | null
          pb?: number | null
          dividend_yield?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      holdings: {
        Row: {
          id: string
          user_id: string
          fund_id: string
          fund_code: string
          fund_name: string
          shares: number
          avg_cost: number
          total_cost: number
          current_nav: number | null
          current_value: number | null
          profit: number | null
          profit_rate: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          fund_id: string
          fund_code: string
          fund_name: string
          shares?: number
          avg_cost?: number
          total_cost?: number
          current_nav?: number | null
          current_value?: number | null
          profit?: number | null
          profit_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          fund_id?: string
          fund_code?: string
          fund_name?: string
          shares?: number
          avg_cost?: number
          total_cost?: number
          current_nav?: number | null
          current_value?: number | null
          profit?: number | null
          profit_rate?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          fund_id: string
          fund_code: string
          fund_name: string
          type: 'buy' | 'sell'
          date: string
          amount: number
          price: number
          shares: number
          fee: number | null
          remark: string | null
          created_at: string
        }
        Insert: {
          id: string
          user_id: string
          fund_id: string
          fund_code: string
          fund_name: string
          type: 'buy' | 'sell'
          date: string
          amount: number
          price: number
          shares: number
          fee?: number | null
          remark?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          fund_id?: string
          fund_code?: string
          fund_name?: string
          type?: 'buy' | 'sell'
          date?: string
          amount?: number
          price?: number
          shares?: number
          fee?: number | null
          remark?: string | null
          created_at?: string
        }
      }
      strategies: {
        Row: {
          id: string
          name: string
          description: string | null
          type: string
          rules: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          description?: string | null
          type: string
          rules?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          type?: string
          rules?: Json
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
