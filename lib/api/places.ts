/**
 * Google Places Autocomplete + Place Details via Supabase Edge Function.
 * Uses Places API (New) with session token (one session = one billable unit) and minimal field masking.
 * - Web & Native: both use Edge Function to avoid CORS and to centralize API key.
 */

/** Generate a session token for Places API (New) session-based billing. One token per search "session". */
export function generateSessionToken(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as { randomUUID?: () => string }).randomUUID === 'function') {
    return (crypto as { randomUUID: () => string }).randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export interface PlaceAutocompleteResult {
  suggestions: string[];
  placeIds: string[];
  error?: string;
}

export interface PlaceDetailsResult {
  formattedAddress: string | null;
  error?: string;
}

/**
 * Invoke Edge Function for autocomplete. Pass sessionToken so all requests in one "search session"
 * are grouped for billing (up to 12 autocomplete + 1 place details = one session).
 */
export async function fetchPlaceAutocomplete(
  input: string,
  sessionToken?: string | null
): Promise<PlaceAutocompleteResult> {
  const trimmed = input.trim();
  if (trimmed.length < 2) {
    return { suggestions: [], placeIds: [] };
  }

  try {
    const { supabase } = await import('@/lib/supabase');
    const { data, error: fnError } = await supabase.functions.invoke<{
      suggestions?: string[];
      placeIds?: string[];
      error?: string;
    }>('places-autocomplete', {
      body: {
        input: trimmed,
        language: 'ko',
        ...(sessionToken?.trim() ? { sessionToken: sessionToken.trim() } : {}),
      },
    });

    if (fnError) {
      return {
        suggestions: [],
        placeIds: [],
        error: fnError.message ?? 'Edge function error',
      };
    }
    return {
      suggestions: data?.suggestions ?? [],
      placeIds: data?.placeIds ?? [],
      error: data?.error,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Network error';
    return { suggestions: [], placeIds: [], error: message };
  }
}

/**
 * Fetch place details (formattedAddress only, Essentials tier) and close the session.
 * Must be called with the same sessionToken used for the autocomplete that produced this placeId.
 */
export async function fetchPlaceDetails(
  placeId: string,
  sessionToken: string
): Promise<PlaceDetailsResult> {
  const id = placeId?.trim();
  const token = sessionToken?.trim();
  if (!id) {
    return { formattedAddress: null, error: 'placeId required' };
  }
  if (!token) {
    return { formattedAddress: null, error: 'sessionToken required to close session' };
  }

  try {
    const { supabase } = await import('@/lib/supabase');
    const { data, error: fnError } = await supabase.functions.invoke<{
      formattedAddress?: string | null;
      error?: string;
    }>('places-autocomplete', {
      body: {
        type: 'placeDetails',
        placeId: id,
        sessionToken: token,
        language: 'ko',
      },
    });

    if (fnError) {
      return {
        formattedAddress: null,
        error: fnError.message ?? 'Edge function error',
      };
    }
    return {
      formattedAddress: data?.formattedAddress ?? null,
      error: data?.error,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Network error';
    return { formattedAddress: null, error: message };
  }
}
