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
      activity_log: {
        Row: {
          actor_profile_id: string | null
          created_at: string
          description: string
          event_type: string
          id: string
          related_customer_id: string | null
          related_order_id: string | null
          related_product_id: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string
          description: string
          event_type: string
          id?: string
          related_customer_id?: string | null
          related_order_id?: string | null
          related_product_id?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          related_customer_id?: string | null
          related_order_id?: string | null
          related_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_related_customer_id_fkey"
            columns: ["related_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_account_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "activity_log_related_customer_id_fkey"
            columns: ["related_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products_with_stock_info"
            referencedColumns: ["id"]
          },
        ]
      }
      cart: {
        Row: {
          added_at: string
          customer_id: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          added_at?: string
          customer_id: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          added_at?: string
          customer_id?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_account_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "cart_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_stock_info"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          updated_at?: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_stock_info"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          assigned_at: string
          billing_address: string | null
          billing_city: string | null
          billing_parish: string | null
          billing_postal: string | null
          business_type: string | null
          company_name: string
          contact_profile_id: string | null
          created_at: string
          credit_limit: number
          current_balance: number
          customer_number: string | null
          customer_source: string | null
          deleted_at: string | null
          delivery_address: string | null
          delivery_address_same_as_billing: boolean
          delivery_city: string | null
          delivery_notes: string | null
          delivery_parish: string | null
          delivery_postal: string | null
          id: string
          is_active: boolean
          notes: string | null
          opening_balance: number
          payment_terms_days: number
          phone: string | null
          pricing_tier: Database["public"]["Enums"]["pricing_tier"]
          sales_rep_name: string | null
          tax_exempt: boolean
          tax_id: string | null
          trading_name: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          billing_address?: string | null
          billing_city?: string | null
          billing_parish?: string | null
          billing_postal?: string | null
          business_type?: string | null
          company_name: string
          contact_profile_id?: string | null
          created_at?: string
          credit_limit?: number
          current_balance?: number
          customer_number?: string | null
          customer_source?: string | null
          deleted_at?: string | null
          delivery_address?: string | null
          delivery_address_same_as_billing?: boolean
          delivery_city?: string | null
          delivery_notes?: string | null
          delivery_parish?: string | null
          delivery_postal?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          opening_balance?: number
          payment_terms_days?: number
          phone?: string | null
          pricing_tier?: Database["public"]["Enums"]["pricing_tier"]
          sales_rep_name?: string | null
          tax_exempt?: boolean
          tax_id?: string | null
          trading_name?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          billing_address?: string | null
          billing_city?: string | null
          billing_parish?: string | null
          billing_postal?: string | null
          business_type?: string | null
          company_name?: string
          contact_profile_id?: string | null
          created_at?: string
          credit_limit?: number
          current_balance?: number
          customer_number?: string | null
          customer_source?: string | null
          deleted_at?: string | null
          delivery_address?: string | null
          delivery_address_same_as_billing?: boolean
          delivery_city?: string | null
          delivery_notes?: string | null
          delivery_parish?: string | null
          delivery_postal?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          opening_balance?: number
          payment_terms_days?: number
          phone?: string | null
          pricing_tier?: Database["public"]["Enums"]["pricing_tier"]
          sales_rep_name?: string | null
          tax_exempt?: boolean
          tax_id?: string | null
          trading_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_contact_profile_id_fkey"
            columns: ["contact_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          last_scan_at: string | null
          line_total: number
          order_id: string
          picked_at: string | null
          picked_quantity: number
          product_id: string
          quantity: number
          shortfall_note: string | null
          shortfall_quantity: number
          unit_price_at_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_scan_at?: string | null
          line_total: number
          order_id: string
          picked_at?: string | null
          picked_quantity?: number
          product_id: string
          quantity: number
          shortfall_note?: string | null
          shortfall_quantity?: number
          unit_price_at_order: number
        }
        Update: {
          created_at?: string
          id?: string
          last_scan_at?: string | null
          line_total?: number
          order_id?: string
          picked_at?: string | null
          picked_quantity?: number
          product_id?: string
          quantity?: number
          shortfall_note?: string | null
          shortfall_quantity?: number
          unit_price_at_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_stock_info"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          approved_at: string | null
          approved_by_profile_id: string | null
          assigned_picker_name: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          carton_count: number | null
          created_at: string
          customer_id: string
          delivered_at: string | null
          delivered_to_name: string | null
          delivery_notes: string | null
          dispatched_at: string | null
          driver_name: string | null
          driver_profile_id: string | null
          due_date: string | null
          eta: string | null
          id: string
          internal_notes: string | null
          invoice_number: string | null
          invoiced_at: string | null
          order_number: string | null
          pack_notes: string | null
          pack_photo_url: string | null
          packed_at: string | null
          packed_by_profile_id: string | null
          paid_at: string | null
          picked_at: string | null
          picked_by_profile_id: string | null
          picking_paused_at: string | null
          picking_started_at: string | null
          placed_at: string
          placed_by_profile_id: string | null
          placed_on_behalf: boolean
          previous_status: Database["public"]["Enums"]["order_status"] | null
          rejection_reason: string | null
          restored_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          vat_amount: number
          vehicle_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_profile_id?: string | null
          assigned_picker_name?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          carton_count?: number | null
          created_at?: string
          customer_id: string
          delivered_at?: string | null
          delivered_to_name?: string | null
          delivery_notes?: string | null
          dispatched_at?: string | null
          driver_name?: string | null
          driver_profile_id?: string | null
          due_date?: string | null
          eta?: string | null
          id?: string
          internal_notes?: string | null
          invoice_number?: string | null
          invoiced_at?: string | null
          order_number?: string | null
          pack_notes?: string | null
          pack_photo_url?: string | null
          packed_at?: string | null
          packed_by_profile_id?: string | null
          paid_at?: string | null
          picked_at?: string | null
          picked_by_profile_id?: string | null
          picking_paused_at?: string | null
          picking_started_at?: string | null
          placed_at?: string
          placed_by_profile_id?: string | null
          placed_on_behalf?: boolean
          previous_status?: Database["public"]["Enums"]["order_status"] | null
          rejection_reason?: string | null
          restored_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          vat_amount?: number
          vehicle_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by_profile_id?: string | null
          assigned_picker_name?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          carton_count?: number | null
          created_at?: string
          customer_id?: string
          delivered_at?: string | null
          delivered_to_name?: string | null
          delivery_notes?: string | null
          dispatched_at?: string | null
          driver_name?: string | null
          driver_profile_id?: string | null
          due_date?: string | null
          eta?: string | null
          id?: string
          internal_notes?: string | null
          invoice_number?: string | null
          invoiced_at?: string | null
          order_number?: string | null
          pack_notes?: string | null
          pack_photo_url?: string | null
          packed_at?: string | null
          packed_by_profile_id?: string | null
          paid_at?: string | null
          picked_at?: string | null
          picked_by_profile_id?: string | null
          picking_paused_at?: string | null
          picking_started_at?: string | null
          placed_at?: string
          placed_by_profile_id?: string | null
          placed_on_behalf?: boolean
          previous_status?: Database["public"]["Enums"]["order_status"] | null
          rejection_reason?: string | null
          restored_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          vat_amount?: number
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_approved_by_profile_id_fkey"
            columns: ["approved_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_account_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_placed_by_profile_id_fkey"
            columns: ["placed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string | null
          payment_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id?: string | null
          payment_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string | null
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cleared_at: string | null
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_number: string | null
          received_by_profile_id: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          cleared_at?: string | null
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_number?: string | null
          received_by_profile_id?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          cleared_at?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_number?: string | null
          received_by_profile_id?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_account_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_received_by_profile_id_fkey"
            columns: ["received_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      picking_events: {
        Row: {
          event_type: string
          id: string
          meta: Json | null
          occurred_at: string
          order_id: string
          order_item_id: string | null
          picker_profile_id: string | null
          quantity: number | null
        }
        Insert: {
          event_type: string
          id?: string
          meta?: Json | null
          occurred_at?: string
          order_id: string
          order_item_id?: string | null
          picker_profile_id?: string | null
          quantity?: number | null
        }
        Update: {
          event_type?: string
          id?: string
          meta?: Json | null
          occurred_at?: string
          order_id?: string
          order_item_id?: string | null
          picker_profile_id?: string | null
          quantity?: number | null
        }
        Relationships: []
      }
      products: {
        Row: {
          archived_at: string | null
          archived_by_profile_id: string | null
          barcode: string | null
          bin_location: string | null
          case_price: number
          category: string
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          lead_time_days: number | null
          name: string
          on_hand: number
          pack_size: number
          pack_unit: string
          primary_image_url: string | null
          reorder_point: number
          reorder_quantity: number
          secondary_image_urls: string[]
          sku: string
          sort_order: number
          stock_status: Database["public"]["Enums"]["stock_status"]
          stock_status_override: Database["public"]["Enums"]["stock_status_override"]
          supplier_name: string | null
          supplier_sku: string | null
          track_inventory: boolean
          unit_price: number
          updated_at: string
          vat_inclusive: boolean
        }
        Insert: {
          archived_at?: string | null
          archived_by_profile_id?: string | null
          barcode?: string | null
          bin_location?: string | null
          case_price: number
          category: string
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          lead_time_days?: number | null
          name: string
          on_hand?: number
          pack_size: number
          pack_unit?: string
          primary_image_url?: string | null
          reorder_point?: number
          reorder_quantity?: number
          secondary_image_urls?: string[]
          sku: string
          sort_order?: number
          stock_status?: Database["public"]["Enums"]["stock_status"]
          stock_status_override?: Database["public"]["Enums"]["stock_status_override"]
          supplier_name?: string | null
          supplier_sku?: string | null
          track_inventory?: boolean
          unit_price: number
          updated_at?: string
          vat_inclusive?: boolean
        }
        Update: {
          archived_at?: string | null
          archived_by_profile_id?: string | null
          barcode?: string | null
          bin_location?: string | null
          case_price?: number
          category?: string
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          lead_time_days?: number | null
          name?: string
          on_hand?: number
          pack_size?: number
          pack_unit?: string
          primary_image_url?: string | null
          reorder_point?: number
          reorder_quantity?: number
          secondary_image_urls?: string[]
          sku?: string
          sort_order?: number
          stock_status?: Database["public"]["Enums"]["stock_status"]
          stock_status_override?: Database["public"]["Enums"]["stock_status_override"]
          supplier_name?: string | null
          supplier_sku?: string | null
          track_inventory?: boolean
          unit_price?: number
          updated_at?: string
          vat_inclusive?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          balance_after: number
          created_at: string
          id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          product_id: string
          quantity: number
          reason: string | null
          recorded_by_profile_id: string | null
          reference: string | null
        }
        Insert: {
          balance_after: number
          created_at?: string
          id?: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          product_id: string
          quantity: number
          reason?: string | null
          recorded_by_profile_id?: string | null
          reference?: string | null
        }
        Update: {
          balance_after?: number
          created_at?: string
          id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          product_id?: string
          quantity?: number
          reason?: string | null
          recorded_by_profile_id?: string | null
          reference?: string | null
        }
        Relationships: []
      }
      stock_notification_requests: {
        Row: {
          created_at: string
          customer_id: string | null
          fulfilled_at: string | null
          id: string
          product_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          fulfilled_at?: string | null
          id?: string
          product_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          fulfilled_at?: string | null
          id?: string
          product_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_notification_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_account_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "stock_notification_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_notification_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_notification_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_stock_info"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      customer_account_summary: {
        Row: {
          available_credit: number | null
          balance_owed: number | null
          count_overdue_invoices: number | null
          customer_id: string | null
          last_payment_amount: number | null
          last_payment_date: string | null
          oldest_unpaid_invoice_age_days: number | null
          total_invoiced: number | null
          total_paid: number | null
        }
        Relationships: []
      }
      products_with_stock_info: {
        Row: {
          archived_at: string | null
          archived_by_profile_id: string | null
          avg_weekly_velocity: number | null
          barcode: string | null
          bin_location: string | null
          case_price: number | null
          category: string | null
          cost_price: number | null
          created_at: string | null
          days_of_stock: number | null
          description: string | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          lead_time_days: number | null
          name: string | null
          on_hand: number | null
          pack_size: number | null
          pack_unit: string | null
          primary_image_url: string | null
          reorder_point: number | null
          reorder_quantity: number | null
          secondary_image_urls: string[] | null
          sku: string | null
          sort_order: number | null
          stock_status: Database["public"]["Enums"]["stock_status"] | null
          stock_status_override:
            | Database["public"]["Enums"]["stock_status_override"]
            | null
          supplier_name: string | null
          supplier_sku: string | null
          track_inventory: boolean | null
          unit_price: number | null
          updated_at: string | null
          vat_inclusive: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_stock_movement: {
        Args: {
          _movement_type: Database["public"]["Enums"]["stock_movement_type"]
          _product_id: string
          _quantity: number
          _reason?: string
          _recorded_by?: string
          _reference?: string
        }
        Returns: string
      }
      current_customer_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      recompute_order_paid_status: {
        Args: { _order_id: string }
        Returns: undefined
      }
      resolve_stock_status: {
        Args: {
          _on_hand: number
          _override: Database["public"]["Enums"]["stock_status_override"]
          _reorder_point: number
          _track: boolean
        }
        Returns: Database["public"]["Enums"]["stock_status"]
      }
    }
    Enums: {
      app_role: "customer" | "office" | "warehouse" | "delivery" | "admin"
      order_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "picking"
        | "packed"
        | "out_for_delivery"
        | "delivered"
        | "invoiced"
        | "paid"
        | "cancelled"
      payment_method:
        | "cash"
        | "cheque"
        | "bank_transfer"
        | "card"
        | "credit_note"
        | "other"
      payment_status: "pending" | "cleared" | "bounced" | "cancelled"
      pricing_tier: "standard" | "volume" | "key_account"
      stock_movement_type:
        | "received"
        | "sold"
        | "damaged"
        | "count_correction"
        | "customer_return"
        | "internal_use"
        | "other"
        | "shortfall"
      stock_status: "in_stock" | "low_stock" | "out_of_stock"
      stock_status_override: "auto" | "in_stock" | "low_stock" | "out_of_stock"
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
      app_role: ["customer", "office", "warehouse", "delivery", "admin"],
      order_status: [
        "draft",
        "pending_approval",
        "approved",
        "picking",
        "packed",
        "out_for_delivery",
        "delivered",
        "invoiced",
        "paid",
        "cancelled",
      ],
      payment_method: [
        "cash",
        "cheque",
        "bank_transfer",
        "card",
        "credit_note",
        "other",
      ],
      payment_status: ["pending", "cleared", "bounced", "cancelled"],
      pricing_tier: ["standard", "volume", "key_account"],
      stock_movement_type: [
        "received",
        "sold",
        "damaged",
        "count_correction",
        "customer_return",
        "internal_use",
        "other",
        "shortfall",
      ],
      stock_status: ["in_stock", "low_stock", "out_of_stock"],
      stock_status_override: ["auto", "in_stock", "low_stock", "out_of_stock"],
    },
  },
} as const
