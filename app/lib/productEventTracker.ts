import type { SupabaseClient } from '@supabase/supabase-js';

type ProductEventName =
  | 'landlord_signup_completed'
  | 'stripe_connect_onboarded'
  | 'first_listing_published'
  | 'first_inquiry_received'
  | 'subscription_started'
  | 'first_rent_payment_success';

type ProductEventPayload = {
  eventName: ProductEventName;
  landlordUserId?: string | null;
  landlordId?: number | null;
  metadata?: Record<string, unknown>;
};

/**
 * Best-effort tracker:
 * - Writes to `product_events` when table exists.
 * - Never throws (prevents analytics from breaking product flows).
 */
export async function trackProductEvent(
  supabaseAdmin: SupabaseClient,
  payload: ProductEventPayload
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('product_events').insert([
      {
        event_name: payload.eventName,
        landlord_user_id: payload.landlordUserId ?? null,
        landlord_id: payload.landlordId ?? null,
        metadata: payload.metadata ?? {},
      },
    ]);

    if (error) {
      console.warn('[product-events] insert warning:', error.message);
    }
  } catch (err) {
    console.warn('[product-events] tracking warning:', err);
  }
}

