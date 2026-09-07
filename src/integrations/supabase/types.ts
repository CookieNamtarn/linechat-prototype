export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      broadcasts: {
        Row: {
          created_at: string
          error: string | null
          id: string
          status: string
          text: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          status?: string
          text: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          status?: string
          text?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          last_message_at: string | null
          last_message_text: string | null
          line_user_id: string
          picture_url: string | null
          unread_count: number
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          line_user_id: string
          picture_url?: string | null
          unread_count?: number
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          line_user_id?: string
          picture_url?: string | null
          unread_count?: number
        }
        Relationships: []
      }
      downtime_logs: {
        Row: {
          created_at: string
          duration_minutes: number | null
          end_time: string | null
          id: string
          order_id: string
          reason: string
          reason_detail: string | null
          start_time: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          order_id: string
          reason: string
          reason_detail?: string | null
          start_time?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          order_id?: string
          reason?: string
          reason_detail?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "downtime_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          machine_code: string
          machine_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          machine_code: string
          machine_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          machine_code?: string
          machine_name?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          conversation_id: string
          created_at: string
          direction: string
          id: string
          line_message_id: string | null
          message_type: string
          text: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          line_message_id?: string | null
          message_type?: string
          text?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          line_message_id?: string | null
          message_type?: string
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      production_events: {
        Row: {
          created_at: string
          event_time: string
          event_type: string
          id: string
          notes: string | null
          order_id: string
        }
        Insert: {
          created_at?: string
          event_time?: string
          event_type: string
          id?: string
          notes?: string | null
          order_id: string
        }
        Update: {
          created_at?: string
          event_time?: string
          event_type?: string
          id?: string
          notes?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          machine_id: string
          notes: string | null
          order_number: string
          planned_end_time: string | null
          planned_quantity: number
          planned_start_time: string | null
          product_id: string
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id: string
          notes?: string | null
          order_number: string
          planned_end_time?: string | null
          planned_quantity: number
          planned_start_time?: string | null
          product_id: string
          status?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id?: string
          notes?: string | null
          order_number?: string
          planned_end_time?: string | null
          planned_quantity?: number
          planned_start_time?: string | null
          product_id?: string
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      production_outputs: {
        Row: {
          created_at: string
          id: string
          ng_qty: number
          ng_reason: string | null
          ok_qty: number
          order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ng_qty?: number
          ng_reason?: string | null
          ok_qty?: number
          order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ng_qty?: number
          ng_reason?: string | null
          ok_qty?: number
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_outputs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          machine_id: string
          notes: string | null
          planned_end_time: string | null
          planned_quantity: number
          planned_start_time: string | null
          product_id: string
          template_name: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          machine_id: string
          notes?: string | null
          planned_end_time?: string | null
          planned_quantity: number
          planned_start_time?: string | null
          product_id: string
          template_name: string
          worker_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          machine_id?: string
          notes?: string | null
          planned_end_time?: string | null
          planned_quantity?: number
          planned_start_time?: string | null
          product_id?: string
          template_name?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_templates_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_templates_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          product_name: string
          sku: string
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          product_name: string
          sku: string
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          product_name?: string
          sku?: string
          unit?: string
        }
        Relationships: []
      }
      workers: {
        Row: {
          created_at: string
          employee_id: string
          full_name: string
          id: string
          is_active: boolean
          line_user_id: string | null
          machine_id: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          full_name: string
          id?: string
          is_active?: boolean
          line_user_id?: string | null
          machine_id?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          full_name?: string
          id?: string
          is_active?: boolean
          line_user_id?: string | null
          machine_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
