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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          country: string | null
          created_at: string
          id: string
          ip_address: string
          metadata: Json | null
          path: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          country?: string | null
          created_at?: string
          id?: string
          ip_address: string
          metadata?: Json | null
          path?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          country?: string | null
          created_at?: string
          id?: string
          ip_address?: string
          metadata?: Json | null
          path?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      blocked_ips: {
        Row: {
          blocked_at: string
          blocked_by: string
          id: string
          ip_address: string
          reason: string | null
        }
        Insert: {
          blocked_at?: string
          blocked_by: string
          id?: string
          ip_address: string
          reason?: string | null
        }
        Update: {
          blocked_at?: string
          blocked_by?: string
          id?: string
          ip_address?: string
          reason?: string | null
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_at: string
          blocked_by: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          blocked_at?: string
          blocked_by: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          blocked_at?: string
          blocked_by?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chatbot_config: {
        Row: {
          created_at: string
          id: string
          system_prompt: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          system_prompt: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          system_prompt?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_drive_folders: {
        Row: {
          client_email: string
          client_name: string
          client_phone: string | null
          created_at: string
          drive_folder_id: string
          drive_folder_link: string
          id: string
          updated_at: string
        }
        Insert: {
          client_email: string
          client_name: string
          client_phone?: string | null
          created_at?: string
          drive_folder_id: string
          drive_folder_link: string
          id?: string
          updated_at?: string
        }
        Update: {
          client_email?: string
          client_name?: string
          client_phone?: string | null
          created_at?: string
          drive_folder_id?: string
          drive_folder_link?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      instrumental_licenses: {
        Row: {
          created_at: string
          description: string | null
          features: string[] | null
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: string[] | null
          id?: string
          is_active?: boolean
          name: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: string[] | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      instrumental_purchases: {
        Row: {
          amount_paid: number
          buyer_email: string
          buyer_name: string | null
          created_at: string
          download_count: number
          download_expires_at: string
          download_token: string
          id: string
          instrumental_id: string
          license_id: string
          payment_id: string | null
          payment_method: string | null
          user_id: string
        }
        Insert: {
          amount_paid: number
          buyer_email: string
          buyer_name?: string | null
          created_at?: string
          download_count?: number
          download_expires_at: string
          download_token: string
          id?: string
          instrumental_id: string
          license_id: string
          payment_id?: string | null
          payment_method?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number
          buyer_email?: string
          buyer_name?: string | null
          created_at?: string
          download_count?: number
          download_expires_at?: string
          download_token?: string
          id?: string
          instrumental_id?: string
          license_id?: string
          payment_id?: string | null
          payment_method?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instrumental_purchases_instrumental_id_fkey"
            columns: ["instrumental_id"]
            isOneToOne: false
            referencedRelation: "instrumentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrumental_purchases_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "instrumental_licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      instrumentals: {
        Row: {
          bpm: number | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          drive_file_id: string
          genre: string | null
          has_stems: boolean | null
          id: string
          is_active: boolean
          key: string | null
          preview_url: string | null
          price_base: number | null
          price_exclusive: number | null
          price_stems: number | null
          stems_folder_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bpm?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          drive_file_id: string
          genre?: string | null
          has_stems?: boolean | null
          id?: string
          is_active?: boolean
          key?: string | null
          preview_url?: string | null
          price_base?: number | null
          price_exclusive?: number | null
          price_stems?: number | null
          stems_folder_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bpm?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          drive_file_id?: string
          genre?: string | null
          has_stems?: boolean | null
          id?: string
          is_active?: boolean
          key?: string | null
          preview_url?: string | null
          price_base?: number | null
          price_exclusive?: number | null
          price_stems?: number | null
          stems_folder_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          auto_select_service: string | null
          code: string
          created_at: string
          custom_price_with_engineer: number | null
          custom_price_without_engineer: number | null
          discount_mastering: number | null
          discount_mixing: number | null
          discount_recording: number | null
          discount_rental: number | null
          full_calendar_visibility: boolean
          id: string
          is_active: boolean
          require_full_payment: boolean | null
          skip_form_fields: boolean
          skip_identity_verification: boolean
          skip_payment: boolean
          updated_at: string
        }
        Insert: {
          auto_select_service?: string | null
          code: string
          created_at?: string
          custom_price_with_engineer?: number | null
          custom_price_without_engineer?: number | null
          discount_mastering?: number | null
          discount_mixing?: number | null
          discount_recording?: number | null
          discount_rental?: number | null
          full_calendar_visibility?: boolean
          id?: string
          is_active?: boolean
          require_full_payment?: boolean | null
          skip_form_fields?: boolean
          skip_identity_verification?: boolean
          skip_payment?: boolean
          updated_at?: string
        }
        Update: {
          auto_select_service?: string | null
          code?: string
          created_at?: string
          custom_price_with_engineer?: number | null
          custom_price_without_engineer?: number | null
          discount_mastering?: number | null
          discount_mixing?: number | null
          discount_recording?: number | null
          discount_rental?: number | null
          full_calendar_visibility?: boolean
          id?: string
          is_active?: boolean
          require_full_payment?: boolean | null
          skip_form_fields?: boolean
          skip_identity_verification?: boolean
          skip_payment?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      sales_config: {
        Row: {
          created_at: string
          discount_analog_mastering: number | null
          discount_mastering: number | null
          discount_mixing: number | null
          discount_percentage: number
          discount_podcast: number | null
          discount_with_engineer: number | null
          discount_without_engineer: number | null
          id: string
          is_active: boolean
          sale_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_analog_mastering?: number | null
          discount_mastering?: number | null
          discount_mixing?: number | null
          discount_percentage?: number
          discount_podcast?: number | null
          discount_with_engineer?: number | null
          discount_without_engineer?: number | null
          id?: string
          is_active?: boolean
          sale_name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_analog_mastering?: number | null
          discount_mastering?: number | null
          discount_mixing?: number | null
          discount_percentage?: number
          discount_podcast?: number | null
          discount_with_engineer?: number | null
          discount_without_engineer?: number | null
          id?: string
          is_active?: boolean
          sale_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          base_price: number
          created_at: string
          id: string
          is_active: boolean
          name_fr: string
          price_unit: string
          service_key: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_price: number
          created_at?: string
          id?: string
          is_active?: boolean
          name_fr: string
          price_unit?: string
          service_key: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name_fr?: string
          price_unit?: string
          service_key?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_email: { Args: { _email: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
