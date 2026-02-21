/**
 * Subscription tier for freemium limits.
 * Payment not integrated yet; tier is stored in profiles.subscription_tier.
 * Use isSubscribed to gate limits (free = apply limits, paid = no limits).
 */

import type { SubscriptionTier } from '../types';
import { useAuth } from './use-auth';

export function useSubscription(): {
  tier: SubscriptionTier;
  isSubscribed: boolean;
} {
  const { profile } = useAuth();
  const tier: SubscriptionTier = profile?.subscriptionTier ?? 'free';
  return {
    tier,
    isSubscribed: tier === 'paid',
  };
}
