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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      cards: {
        Row: {
          card_number: number
          created_at: string
          event_id: number
          guest_email: string | null
          guest_name: string | null
          id: number
          revealed_at: string | null
          status: string
          unlock_code: string | null
          value: number | null
        }
        Insert: {
          card_number: number
          created_at?: string
          event_id: number
          guest_email?: string | null
          guest_name?: string | null
          id?: number
          revealed_at?: string | null
          status?: string
          unlock_code?: string | null
          value?: number | null
        }
        Update: {
          card_number?: number
          created_at?: string
          event_id?: number
          guest_email?: string | null
          guest_name?: string | null
          id?: number
          revealed_at?: string | null
          status?: string
          unlock_code?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          date: string | null
          description: string | null
          goal_amount: number | null
          host_id: string
          id: number
          max_value: number
          min_value: number
          name: string
          num_cards: number
          slug: string
          theme_color: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date?: string | null
          description?: string | null
          goal_amount?: number | null
          host_id: string
          id?: number
          max_value?: number
          min_value?: number
          name: string
          num_cards?: number
          slug: string
          theme_color?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string | null
          description?: string | null
          goal_amount?: number | null
          host_id?: string
          id?: number
          max_value?: number
          min_value?: number
          name?: string
          num_cards?: number
          slug?: string
          theme_color?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      guests: {
        Row: {
          created_at: string
          email: string
          event_id: number | null
          id: number
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          event_id?: number | null
          id?: number
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          event_id?: number | null
          id?: number
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          event_id: number
          guest_email: string
          guest_name: string | null
          id: number
          message: string
        }
        Insert: {
          created_at?: string
          event_id: number
          guest_email: string
          guest_name?: string | null
          id?: number
          message: string
        }
        Update: {
          created_at?: string
          event_id?: number
          guest_email?: string
          guest_name?: string | null
          id?: number
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          card_id: number
          created_at: string
          event_id: number
          guest_email: string
          id: number
          paid_at: string | null
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          amount: number
          card_id: number
          created_at?: string
          event_id: number
          guest_email: string
          id?: number
          paid_at?: string | null
          status?: string
          stripe_session_id?: string | null
        }
        Update: {
          amount?: number
          card_id?: number
          created_at?: string
          event_id?: number
          guest_email?: string
          id?: number
          paid_at?: string | null
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          cpf: string | null
          created_at: string
          dob: string | null
          id: string
          name: string
          phone: string | null
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          cpf?: string | null
          created_at?: string
          dob?: string | null
          id?: string
          name: string
          phone?: string | null
          plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          cpf?: string | null
          created_at?: string
          dob?: string | null
          id?: string
          name?: string
          phone?: string | null
          plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      unlock_code_attempts: {
        Row: {
          attempts: number | null
          card_number: number
          created_at: string | null
          email: string
          event_id: number
          id: string
          locked_until: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          card_number: number
          created_at?: string | null
          email: string
          event_id: number
          id?: string
          locked_until?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          card_number?: number
          created_at?: string | null
          email?: string
          event_id?: number
          id?: string
          locked_until?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_unlock_rate_limit: {
        Args: { _card_number: number; _email: string; _event_id: number }
        Returns: {
          allowed: boolean
          attempts_remaining: number
          locked_until: string
        }[]
      }
      generate_event_cards: {
        Args: { event_id_param: number; num_cards_param: number }
        Returns: undefined
      }
      generate_event_cards_with_values: {
        Args: {
          event_id_param: number
          goal_amount_param: number
          max_value_param: number
          min_value_param: number
          num_cards_param: number
        }
        Returns: undefined
      }
      get_public_cards_by_event: {
        Args: { _event_id: number }
        Returns: {
          card_number: number
          guest_name: string
          id: number
          revealed_at: string
          status: string
        }[]
      }
      get_public_event_by_slug: {
        Args: { _slug: string }
        Returns: {
          date: string
          description: string
          goal_amount: number
          id: number
          name: string
          num_cards: number
          theme_color: string
        }[]
      }
      verify_unlock_code_and_reveal: {
        Args: {
          _card_number: number
          _email: string
          _event_id: number
          _guest_name?: string
          _unlock_code: string
        }
        Returns: {
          card_value: number
          message: string
          success: boolean
        }[]
      }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
