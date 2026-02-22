/**
 * Shared Profile Cache and Fetching Utility
 * Prevents duplicate API calls for the same user IDs
 */

import { Platform } from 'react-native';
import { supabase } from '../supabase';

import type { SubscriptionTier } from '../types';

export interface ProfileDataRow {
  id: string;
  nickname: string;
  avatar_url: string | null;
  subscription_tier: SubscriptionTier;
  subscription_expires_at: string | null;
  subscription_external_id: string | null;
  subscription_provider: string | null;
}

// Global profile cache
const profileCache = new Map<string, ProfileDataRow>();
const profileCacheTimestamp = new Map<string, number>();
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Pending requests map to prevent duplicate concurrent requests
const pendingRequests = new Map<string, Promise<Map<string, ProfileData>>>();

export interface ProfileData {
  id: string;
  nickname: string;
  avatar_url: string | null;
  subscription_tier: SubscriptionTier;
  subscription_expires_at: string | null;
  subscription_external_id: string | null;
  subscription_provider: string | null;
}

/**
 * Fetch profiles for user IDs (with global caching and request deduplication)
 * If multiple requests come for the same user IDs simultaneously, only one API call is made
 */
export async function fetchProfiles(userIds: string[]): Promise<Map<string, ProfileData>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const now = Date.now();
  const uncachedUserIds: string[] = [];
  const profileMap = new Map<string, ProfileData>();

  // Check cache first
  userIds.forEach(userId => {
    const cached = profileCache.get(userId);
    const timestamp = profileCacheTimestamp.get(userId);
    
    if (cached && timestamp && (now - timestamp) < PROFILE_CACHE_TTL) {
      // Use cached profile
      profileMap.set(userId, cached);
    } else {
      // Need to fetch
      uncachedUserIds.push(userId);
    }
  });

  // If all profiles are cached, return immediately
  if (uncachedUserIds.length === 0) {
    return profileMap;
  }

  // Sort user IDs to create a consistent key for request deduplication
  const sortedUserIds = [...uncachedUserIds].sort();
  const requestKey = sortedUserIds.join(',');

  // Check if there's already a pending request for these user IDs
  let fetchPromise = pendingRequests.get(requestKey);
  
  if (!fetchPromise) {
    // Create new fetch promise
    fetchPromise = (async () => {
      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url, subscription_tier, subscription_expires_at, subscription_external_id, subscription_provider')
          .in('id', uncachedUserIds);

        if (error) {
          console.error('[fetchProfiles] Error fetching profiles:', error);
          return new Map<string, ProfileData>();
        }

        const resultMap = new Map<string, ProfileData>();
        
        if (profiles) {
          profiles.forEach(profile => {
            const profileData: ProfileData = {
              id: profile.id,
              nickname: profile.nickname,
              avatar_url: profile.avatar_url,
              subscription_tier: (profile.subscription_tier === 'paid' ? 'paid' : 'free') as SubscriptionTier,
              subscription_expires_at: profile.subscription_expires_at ?? null,
              subscription_external_id: profile.subscription_external_id ?? null,
              subscription_provider: profile.subscription_provider ?? null,
            };
            profileCache.set(profile.id, profileData as ProfileDataRow);
            profileCacheTimestamp.set(profile.id, now);
            resultMap.set(profile.id, profileData);
          });
        }

        return resultMap;
      } finally {
        // Remove from pending requests after completion
        pendingRequests.delete(requestKey);
      }
    })();

    // Store the promise for other concurrent requests
    pendingRequests.set(requestKey, fetchPromise);
  }

  // Wait for the fetch (either new or existing)
  const fetchedProfiles = await fetchPromise;

  // Merge fetched profiles with cached ones
  fetchedProfiles.forEach((profile, userId) => {
    profileMap.set(userId, profile);
  });

  return profileMap;
}

/**
 * Fetch a single profile (uses the shared cache)
 */
export async function fetchProfile(userId: string): Promise<ProfileData | null> {
  const profiles = await fetchProfiles([userId]);
  return profiles.get(userId) || null;
}

/**
 * Clear profile cache (useful for testing or forced refresh)
 */
export function clearProfileCache() {
  profileCache.clear();
  profileCacheTimestamp.clear();
  pendingRequests.clear();
}

/**
 * Test only: set current user subscription to paid (1 month). Remove when payment is integrated.
 */
export async function subscriptionTestActivate(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('subscription_test_activate');
  if (error) return { error: error.message };
  clearProfileCache();
  return { error: null };
}

/**
 * Test only: set current user subscription to free. Remove when payment is integrated.
 */
export async function subscriptionTestDeactivate(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('subscription_test_deactivate');
  if (error) return { error: error.message };
  clearProfileCache();
  return { error: null };
}

/**
 * Upload avatar image to Supabase Storage
 * @param userId - User ID
 * @param imageUri - Local image URI (from expo-image-picker)
 * @returns Public URL of uploaded image or error
 */
export async function uploadAvatar(
  userId: string,
  imageUri: string
): Promise<{ data: string | null; error: Error | null }> {
  try {
    // Generate unique filename with proper extension
    let fileExt = 'jpg'; // default
    
    if (imageUri.startsWith('data:')) {
      // Base64 data URI: extract extension from MIME type
      // Format: data:image/jpeg;base64,... or data:image/png;base64,...
      const mimeMatch = imageUri.match(/data:image\/([^;]+)/);
      if (mimeMatch) {
        const mimeType = mimeMatch[1];
        // Map MIME types to file extensions
        const mimeToExt: { [key: string]: string } = {
          'jpeg': 'jpg',
          'jpg': 'jpg',
          'png': 'png',
          'gif': 'gif',
          'webp': 'webp',
        };
        fileExt = mimeToExt[mimeType] || 'jpg';
      }
    } else {
      // File URI: extract extension from file path
      const uriParts = imageUri.split('.');
      if (uriParts.length > 1) {
        const ext = uriParts.pop()?.split('?')[0]?.toLowerCase();
        if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
          fileExt = ext === 'jpeg' ? 'jpg' : ext;
        }
      }
    }
    
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    
    // Log upload start (avoid logging objects that may contain binary data)
    console.log('[uploadAvatar] Starting upload');
    console.log('[uploadAvatar] User ID:', userId);
    console.log('[uploadAvatar] File name:', fileName);
    console.log('[uploadAvatar] File extension:', fileExt);
    console.log('[uploadAvatar] Image type:', imageUri.startsWith('data:') ? 'base64' : 'file-uri');

    // Read file and prepare for upload - React Native compatible approach
    let fileData: Blob | Uint8Array;
    let contentType: string;
    let fileSize: number;
    
    if (Platform.OS === 'web') {
      // Web: Use fetch with blob
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();
      fileData = blob;
      contentType = blob.type || 'image/jpeg';
      fileSize = blob.size;
      console.log('[uploadAvatar] Web blob created - size:', Math.round(fileSize / 1024), 'KB, type:', contentType);
    } else {
      // React Native: Convert base64 or file URI to Uint8Array (more reliable than Blob)
      if (imageUri.startsWith('data:')) {
        // Base64 data URI - Decode directly to Uint8Array
        const base64Data = imageUri.split(',')[1];
        if (!base64Data) {
          throw new Error('Invalid base64 data URI format');
        }
        
        // Extract MIME type for contentType
        const mimeMatch = imageUri.match(/data:image\/([^;]+)/);
        contentType = mimeMatch ? `image/${mimeMatch[1]}` : 'image/jpeg';
        
        // Decode base64 to Uint8Array
        // Try multiple approaches for React Native compatibility
        try {
          let byteArray: Uint8Array;
          
          // Method 1: Try Buffer (available in React Native through polyfills)
          if (typeof Buffer !== 'undefined') {
            byteArray = new Uint8Array(Buffer.from(base64Data, 'base64'));
            console.log('[uploadAvatar] Using Buffer for base64 decode');
          } 
          // Method 2: Try atob (available in some React Native environments)
          else if (typeof atob !== 'undefined') {
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            byteArray = new Uint8Array(byteNumbers);
            console.log('[uploadAvatar] Using atob for base64 decode');
          } 
          // Method 3: Manual base64 decoding (fallback)
          else {
            // Simple base64 decoder
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            let result: number[] = [];
            let i = 0;
            
            base64Data = base64Data.replace(/[^A-Za-z0-9\+\/]/g, '');
            
            while (i < base64Data.length) {
              const encoded1 = chars.indexOf(base64Data.charAt(i++));
              const encoded2 = chars.indexOf(base64Data.charAt(i++));
              const encoded3 = chars.indexOf(base64Data.charAt(i++));
              const encoded4 = chars.indexOf(base64Data.charAt(i++));
              
              const bitmap = (encoded1 << 18) | (encoded2 << 12) | (encoded3 << 6) | encoded4;
              
              result.push((bitmap >> 16) & 255);
              if (encoded3 !== 64) result.push((bitmap >> 8) & 255);
              if (encoded4 !== 64) result.push(bitmap & 255);
            }
            
            byteArray = new Uint8Array(result);
            console.log('[uploadAvatar] Using manual base64 decode');
          }
          
          fileData = byteArray;
          fileSize = fileData.length;
          console.log('[uploadAvatar] React Native base64 decoded to Uint8Array - size:', Math.round(fileSize / 1024), 'KB');
        } catch (decodeError: any) {
          console.error('[uploadAvatar] Base64 decode error:', decodeError.message);
          throw new Error(`Failed to decode base64 image: ${decodeError.message}`);
        }
      } else {
        // File URI - use fetch and convert to Uint8Array
        try {
          const response = await fetch(imageUri);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
          }
          
          // Convert response to ArrayBuffer, then to Uint8Array
          const arrayBuffer = await response.arrayBuffer();
          fileData = new Uint8Array(arrayBuffer);
          fileSize = fileData.length;
          
          // Try to get content type from response
          contentType = response.headers.get('content-type') || 'image/jpeg';
          
          if (fileSize === 0) {
            throw new Error('Fetched file is empty');
          }
          
          console.log('[uploadAvatar] React Native file URI converted to Uint8Array - size:', Math.round(fileSize / 1024), 'KB, type:', contentType);
        } catch (fetchError: any) {
          console.error('[uploadAvatar] Fetch error:', fetchError.message);
          throw new Error(`Failed to read image file: ${fetchError.message}`);
        }
      }
    }

    // Validate file size
    if (!fileData || fileSize === 0) {
      console.error('[uploadAvatar] File is empty or invalid - size:', fileSize);
      return { data: null, error: new Error('Failed to read image file. File may be empty or corrupted.') };
    }

    // Check file size limit (5MB = 5242880 bytes)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (fileSize > MAX_FILE_SIZE) {
      console.error('[uploadAvatar] File too large - size:', Math.round(fileSize / 1024), 'KB, max:', Math.round(MAX_FILE_SIZE / 1024), 'KB');
      return { data: null, error: new Error(`File size (${Math.round(fileSize / 1024)}KB) exceeds maximum allowed size (5MB). Please choose a smaller image.`) };
    }

    // Log upload info (avoid logging objects)
    console.log('[uploadAvatar] File ready for upload');
    console.log('[uploadAvatar] File size:', Math.round(fileSize / 1024), 'KB');
    console.log('[uploadAvatar] Content type:', contentType);

    // Upload to Supabase Storage
    // Supabase accepts Blob, File, ArrayBuffer, or Uint8Array
    console.log('[uploadAvatar] Attempting upload to Supabase Storage...');
    console.log('[uploadAvatar] Bucket: avatars');
    console.log('[uploadAvatar] File name:', fileName);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, fileData, {
        cacheControl: '3600',
        upsert: true, // Replace existing file
        contentType: contentType,
      });

    if (uploadError) {
      console.error('[uploadAvatar] ========== UPLOAD ERROR ==========');
      console.error('[uploadAvatar] Error message:', uploadError.message);
      console.error('[uploadAvatar] Error name:', (uploadError as any).name);
      console.error('[uploadAvatar] Error statusCode:', (uploadError as any).statusCode);
      console.error('[uploadAvatar] Error status:', (uploadError as any).status);
      console.error('[uploadAvatar] File name:', fileName);
      console.error('[uploadAvatar] File path check:');
      console.error('[uploadAvatar] - Expected folder:', userId);
      console.error('[uploadAvatar] - Actual folder:', fileName.split('/')[0]);
      console.error('[uploadAvatar] - Matches:', fileName.split('/')[0] === userId);
      console.error('[uploadAvatar] Blob size:', blob.size, 'bytes');
      console.error('[uploadAvatar] Blob type:', blob.type);
      
      // Log error details (avoid JSON.stringify which may include binary data)
      console.error('[uploadAvatar] Error summary:');
      console.error('[uploadAvatar] - Message:', uploadError.message);
      console.error('[uploadAvatar] - Name:', (uploadError as any).name);
      console.error('[uploadAvatar] - Status code:', (uploadError as any).statusCode);
      console.error('[uploadAvatar] - Status:', (uploadError as any).status);
      console.error('[uploadAvatar] ====================================');
      
      // Provide more helpful error message
      const errorStatus = (uploadError as any).statusCode || (uploadError as any).status;
      let errorMessage = uploadError.message || 'Failed to upload avatar';
      
      // "Network request failed" usually means connection issue or invalid request (e.g., invalid filename)
      if (errorMessage.includes('Network request failed')) {
        errorMessage = 'Network request failed. Possible causes:\n' +
          '1. Invalid file name format\n' +
          '2. Internet connection issue\n' +
          '3. Supabase Storage bucket "avatars" not found\n' +
          '4. Storage policies not configured\n\n' +
          'Please check STORAGE_SETUP_GUIDE.md for setup instructions.';
      } else if (errorMessage.includes('JSON Parse error') || errorMessage.includes('Unexpected character: <')) {
        errorMessage = 'Storage bucket not found or access denied. Please check:\n' +
          '1. Create "avatars" bucket in Supabase Dashboard (Storage > Create Bucket)\n' +
          '2. Set bucket to Public (Settings > Public bucket: ON)\n' +
          '3. Configure Storage policies (see STORAGE_SETUP_GUIDE.md)';
      } else if (errorStatus === 403 || errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('policy')) {
        errorMessage = 'Storage permission denied. Please check Supabase Storage policies. Make sure the avatars bucket exists and has proper INSERT policy.';
      } else if (errorStatus === 400) {
        errorMessage = 'Invalid file format or storage configuration issue.';
      } else if (errorStatus === 404) {
        errorMessage = 'Storage bucket not found. Please create the "avatars" bucket in Supabase Storage.';
      } else if (errorMessage.includes('new row violates row-level security')) {
        errorMessage = 'Storage policy violation. Please check Supabase Storage policies for the avatars bucket.';
      }
      
      return { data: null, error: new Error(errorMessage) };
    }

    console.log('[uploadAvatar] Upload successful:', fileName);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      console.error('[uploadAvatar] Failed to get public URL for:', fileName);
      return { data: null, error: new Error('Failed to get public URL') };
    }

    // Trim and clean the URL
    const cleanUrl = urlData.publicUrl.trim();
    console.log('[uploadAvatar] Generated public URL:', cleanUrl);

    // Update profile with new avatar URL
    console.log('[uploadAvatar] Updating profile with new avatar URL...');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: cleanUrl })
      .eq('id', userId);

    if (updateError) {
      console.error('[uploadAvatar] Update profile error:', updateError);
      console.error('[uploadAvatar] Update error message:', updateError.message);
      return { data: null, error: updateError as Error };
    }

    console.log('[uploadAvatar] Profile updated successfully');

    // Clear cache for this user
    profileCache.delete(userId);
    profileCacheTimestamp.delete(userId);

    console.log('[uploadAvatar] Cache cleared for user:', userId);

    return { data: cleanUrl, error: null };
  } catch (error) {
    console.error('[uploadAvatar] Unexpected error:', error);
    return { data: null, error: error as Error };
  }
}
