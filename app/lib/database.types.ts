export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      documents: {
        Row: {
          id: number;
          created_at: string;
          title: string;
          file_url: string;
          storage_path: string;
          property_id: number | null;
          tenant_id: number | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          title: string;
          file_url: string;
          storage_path: string;
          property_id?: number | null;
          tenant_id?: number | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          title?: string;
          file_url?: string;
          storage_path?: string;
          property_id?: number | null;
          tenant_id?: number | null;
        };
        Relationships: [];
      };
      esign_envelopes: {
        Row: {
          id: number;
          landlord_user_id: string;
          landlord_email: string | null;
          document_title: string;
          signer_name: string | null;
          signer_email: string | null;
          stripe_session_id: string | null;
          stripe_payment_intent_id: string | null;
          amount_cents: number;
          status: string;
          esign_provider: string | null;
          esign_request_id: string | null;
          esign_signing_url: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          landlord_user_id: string;
          landlord_email: string | null;
          document_title: string;
          signer_name: string | null;
          signer_email: string | null;
          stripe_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          amount_cents: number;
          status?: string | null;
          esign_provider?: string | null;
          esign_request_id?: string | null;
          esign_signing_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          landlord_user_id?: string;
          landlord_email?: string;
          document_title?: string;
          signer_name?: string;
          signer_email?: string;
          stripe_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          amount_cents?: number;
          status?: string | null;
          esign_provider?: string | null;
          esign_request_id?: string | null;
          esign_signing_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      esign_purchases: {
        Row: {
          id: string;
          landlord_user_id: string;
          signatures: number;
          amount: number | null;
          paid_at: string;
          stripe_payment_intent_id: string | null;
          stripe_checkout_session_id: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          landlord_user_id: string;
          signatures: number;
          amount: number | null;
          paid_at?: string;
          stripe_payment_intent_id?: string | null;
          stripe_checkout_session_id?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          landlord_user_id?: string;
          signatures?: number;
          amount?: number | null;
          paid_at?: string;
          stripe_payment_intent_id?: string | null;
          stripe_checkout_session_id?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          landlord_id: number | null;
          property_id: number | null;
          amount: number;
          category: string | null;
          description: string | null;
          expense_date: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          landlord_id?: number | null;
          property_id?: number | null;
          amount: number;
          category?: string | null;
          description?: string | null;
          expense_date?: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          landlord_id?: number | null;
          property_id?: number | null;
          amount?: number;
          category?: string | null;
          description?: string | null;
          expense_date?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      landlord_team_members: {
        Row: {
          id: number | string;
          owner_user_id: string;
          member_email: string | null;
          member_user_id: string | null;
          role: string;
          invited_at: string;
          accepted_at: string | null;
          created_at: string;
          invite_email: string | null;
          status: string | null;
          owner_landlord_id: number | null;
        };
        Insert: {
          id?: number | string;
          owner_user_id: string;
          member_email?: string | null;
          member_user_id?: string | null;
          role?: string;
          invited_at?: string;
          accepted_at?: string | null;
          created_at?: string;
          invite_email?: string | null;
          status?: string | null;
          owner_landlord_id?: number | null;
        };
        Update: {
          id?: number | string;
          owner_user_id?: string;
          member_email?: string | null;
          member_user_id?: string | null;
          role?: string;
          invited_at?: string;
          accepted_at?: string | null;
          created_at?: string;
          invite_email?: string | null;
          status?: string | null;
          owner_landlord_id?: number | null;
        };
        Relationships: [];
      };
      landlords: {
        Row: {
          id: number;
          name: string | null;
          email: string | null;
          stripe_account_id: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          subscription_current_period_end: string | null;
          user_id: string;
          stripe_connect_account_id: string | null;
          stripe_connect_onboarded: boolean | null;
          trial_active: boolean;
          trial_end: string | null;
          subscription_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          name?: string | null;
          email?: string | null;
          stripe_account_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          subscription_current_period_end?: string | null;
          user_id?: string;
          stripe_connect_account_id?: string | null;
          stripe_connect_onboarded?: boolean | null;
          trial_active?: boolean;
          trial_end?: string | null;
          subscription_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string | null;
          email?: string | null;
          stripe_account_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          subscription_current_period_end?: string | null;
          user_id?: string;
          stripe_connect_account_id?: string | null;
          stripe_connect_onboarded?: boolean | null;
          trial_active?: boolean;
          trial_end?: string | null;
          subscription_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      listing_inquiries: {
        Row: {
          id: number;
          created_at: string;
          listing_id: number;
          owner_id: string;
          name: string;
          email: string;
          phone: string | null;
          message: string | null;
          status: string;
        };
        Insert: {
          id?: number;
          created_at?: string;
          listing_id: number;
          owner_id: string;
          name: string;
          email: string;
          phone?: string | null;
          message?: string | null;
          status?: string;
        };
        Update: {
          id?: number;
          created_at?: string;
          listing_id?: number;
          owner_id?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          message?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      listing_leads: {
        Row: {
          id: number;
          listing_id: number;
          name: string;
          email: string;
          phone: string | null;
          message: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          listing_id: number;
          name: string;
          email: string;
          phone?: string | null;
          message?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          listing_id?: number;
          name?: string;
          email?: string;
          phone?: string | null;
          message?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      listing_photos: {
        Row: {
          id: number;
          created_at: string;
          listing_id: number;
          owner_id: string;
          image_url: string;
          sort_order: number;
        };
        Insert: {
          id?: number;
          created_at?: string;
          listing_id: number;
          owner_id: string;
          image_url: string;
          sort_order?: number;
        };
        Update: {
          id?: number;
          created_at?: string;
          listing_id?: number;
          owner_id?: string;
          image_url?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      listings: {
        Row: {
          id: number;
          created_at: string;
          owner_id: string;
          property_id: number | null;
          title: string;
          slug: string;
          status: string;
          published: boolean;
          published_at: string | null;
          city: string | null;
          state: string | null;
          neighborhood: string | null;
          rent_amount: number | null;
          deposit_amount: number | null;
          available_date: string | null;
          beds: number | null;
          baths: number | null;
          sqft: number | null;
          description: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          hide_exact_address: boolean;
          address_line1: string | null;
          address_line2: string | null;
          postal_code: string | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          owner_id?: string;
          property_id?: number | null;
          title?: string;
          slug?: string;
          status?: string | null;
          published?: boolean;
          published_at?: string | null;
          city?: string | null;
          state?: string | null;
          neighborhood?: string | null;
          rent_amount?: number | null;
          deposit_amount?: number | null;
          available_date?: string | null;
          beds?: number | null;
          baths?: number | null;
          sqft?: number | null;
          description?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          hide_exact_address?: boolean;
          address_line1?: string | null;
          address_line2?: string | null;
          postal_code?: string | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          owner_id?: string;
          property_id?: number | null;
          title?: string;
          slug?: string;
          status?: string | null;
          published?: boolean;
          published_at?: string | null;
          city?: string | null;
          state?: string | null;
          neighborhood?: string | null;
          rent_amount?: number | null;
          deposit_amount?: number | null;
          available_date?: string | null;
          beds?: number | null;
          baths?: number | null;
          sqft?: number | null;
          description?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          hide_exact_address?: boolean;
          address_line1?: string | null;
          address_line2?: string | null;
          postal_code?: string | null;
        };
        Relationships: [];
      };
      maintenance_requests: GenericTable;
      messages: GenericTable;
      payments: GenericTable;
      product_events: GenericTable;
      properties: GenericTable;
      tenants: GenericTable;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
