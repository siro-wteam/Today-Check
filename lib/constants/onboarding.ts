/** AsyncStorage key: whether the user has completed the first-run onboarding */
export const ONBOARDING_STORAGE_KEY = 'todaycheck_has_seen_onboarding';

/** Set to true right after user taps "시작하기" so root layout doesn't redirect back to onboarding before storage is re-read */
export let justCompletedOnboarding = false;
export function setJustCompletedOnboarding(value: boolean) {
  justCompletedOnboarding = value;
}
