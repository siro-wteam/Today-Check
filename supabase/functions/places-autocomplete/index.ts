// Supabase Edge Function: proxy for Google Places API (New) with session token + field masking.
// - Autocomplete (New): session token groups typing into one billable session; minimal field mask.
// - Place Details (New): called on select with same token; only formattedAddress (Essentials).
// Set secret: supabase secrets set GOOGLE_PLACES_API_KEY=your-key
// Deploy: supabase functions deploy places-autocomplete --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACE_DETAILS_BASE = 'https://places.googleapis.com/v1/places';

interface ReqBodyAutocomplete {
  input: string;
  language?: string;
  sessionToken?: string;
}

interface ReqBodyPlaceDetails {
  type: 'placeDetails';
  placeId: string;
  sessionToken: string;
  language?: string;
}

type ReqBody = ReqBodyAutocomplete | ReqBodyPlaceDetails;

interface NewAutocompleteSuggestion {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
  };
}

interface NewAutocompleteResponse {
  suggestions?: NewAutocompleteSuggestion[];
}

function isPlaceDetailsBody(b: ReqBody): b is ReqBodyPlaceDetails {
  return (b as ReqBodyPlaceDetails).type === 'placeDetails';
}

serve(async (req) => {
  const allowHeaders = 'Content-Type, Authorization, apikey, x-client-info';
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': allowHeaders,
      },
    });
  }

  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': allowHeaders };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!apiKey?.trim()) {
    return new Response(
      JSON.stringify({ suggestions: [], error: 'Google Places API key not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return new Response(JSON.stringify({ suggestions: [], error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  // Place Details (New): minimal field mask (formattedAddress = Essentials tier)
  if (isPlaceDetailsBody(body)) {
    const placeId = typeof body.placeId === 'string' ? body.placeId.trim() : '';
    const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken.trim() : '';
    if (!placeId) {
      return new Response(
        JSON.stringify({ formattedAddress: null, error: 'placeId required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }
    const lang = body.language ?? 'ko';
    const url = `${PLACE_DETAILS_BASE}/${encodeURIComponent(placeId)}?languageCode=${encodeURIComponent(lang)}${sessionToken ? `&sessionToken=${encodeURIComponent(sessionToken)}` : ''}`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'formattedAddress',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        const err = (data?.error?.message ?? data?.message ?? res.statusText) as string;
        return new Response(
          JSON.stringify({ formattedAddress: null, error: err }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
        );
      }
      const formattedAddress =
        typeof data?.formattedAddress === 'string' ? data.formattedAddress : null;
      return new Response(JSON.stringify({ formattedAddress }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Network error';
      return new Response(
        JSON.stringify({ formattedAddress: null, error: message }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }
  }

  // Autocomplete (New): session token + minimal field mask
  const input =
    typeof (body as ReqBodyAutocomplete).input === 'string'
      ? (body as ReqBodyAutocomplete).input.trim()
      : '';
  if (input.length < 2) {
    return new Response(JSON.stringify({ suggestions: [], placeIds: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const language = (body as ReqBodyAutocomplete).language ?? 'ko';
  const sessionToken = (body as ReqBodyAutocomplete).sessionToken;
  const payload: Record<string, unknown> = {
    input,
    languageCode: language,
  };
  if (sessionToken?.trim()) {
    payload.sessionToken = sessionToken.trim();
  }

  try {
    const res = await fetch(AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text',
      },
      body: JSON.stringify(payload),
    });
    const data: NewAutocompleteResponse = await res.json();
    if (!res.ok) {
      const err = (data as { error?: { message?: string } })?.error?.message ?? res.statusText;
      return new Response(
        JSON.stringify({ suggestions: [], placeIds: [], error: err }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }
    const suggestions: string[] = [];
    const placeIds: string[] = [];
    for (const s of data.suggestions ?? []) {
      const pred = s.placePrediction;
      if (!pred) continue;
      const text = pred.text?.text?.trim();
      const id = pred.placeId?.trim();
      if (text) suggestions.push(text);
      if (id) placeIds.push(id);
    }
    return new Response(JSON.stringify({ suggestions, placeIds }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Network error';
    return new Response(
      JSON.stringify({ suggestions: [], placeIds: [], error: message }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
});
