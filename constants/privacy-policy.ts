/**
 * Privacy Policy content (English) for TodayCheck.
 * Used by the /privacy web page and by the in-app fallback on native when no URL is set.
 */

export const PRIVACY_POLICY_LAST_UPDATED = '2025-01-28';

export const PRIVACY_POLICY_SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Introduction',
    body: 'TodayCheck ("we", "our", or "the app") is a task management application. This Privacy Policy explains how we collect, use, and protect your information when you use our app and services. By using TodayCheck, you agree to the practices described in this policy.',
  },
  {
    title: '2. Information We Collect',
    body: 'We collect information necessary to provide and improve the service:\n\n' +
      '• Account information: email address and password (stored securely, password is hashed).\n\n' +
      '• Profile information: nickname and optional profile photo (avatar) that you choose to set.\n\n' +
      '• Task and group data: tasks you create or are assigned to (titles, due dates, status, assignees), and groups you create or join (names, member lists, group images).\n\n' +
      '• Device information: we may use device identifiers or tokens to deliver push notifications (e.g. task reminders) if you enable notifications.',
  },
  {
    title: '3. How We Use Your Information',
    body: 'We use the information we collect to:\n\n' +
      '• Provide the app\'s features (task lists, weekly view, groups, backlog).\n\n' +
      '• Sync your data across devices when you sign in.\n\n' +
      '• Send you push notifications (e.g. reminders for tasks with due dates and times) if you have allowed notifications.\n\n' +
      '• Improve the app and fix issues.\n\n' +
      'We do not sell your personal information to third parties.',
  },
  {
    title: '4. Data Storage and Third-Party Services',
    body: 'Your data is stored and processed using Supabase (supabase.com), which provides our database and authentication. Supabase may process data in accordance with their privacy policy and applicable data processing agreements. Profile and group images may be stored in cloud storage associated with our backend. Push notifications are delivered via Expo\'s notification services. By using the app, you acknowledge that these third-party services process your data as necessary to operate the service.',
  },
  {
    title: '5. Data Retention and Deletion',
    body: 'We retain your account and task data for as long as your account is active. You may delete your account or request deletion of your data; we will process such requests in accordance with applicable law. Some data may remain in backups for a limited period before being purged.',
  },
  {
    title: '6. Security',
    body: 'We use industry-standard practices to protect your data, including secure (HTTPS) connections and hashed passwords. No method of transmission or storage is 100% secure; we encourage you to use a strong password and keep your account credentials private.',
  },
  {
    title: '7. Your Rights',
    body: 'Depending on your jurisdiction, you may have the right to access, correct, or delete your personal data, or to object to or restrict certain processing. You can update your profile and manage your data within the app. To disable push notifications, use your device settings. For other requests, please contact us using the contact information below.',
  },
  {
    title: '8. Children',
    body: 'TodayCheck is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe we have collected such information, please contact us so we can delete it.',
  },
  {
    title: '9. Changes to This Policy',
    body: 'We may update this Privacy Policy from time to time. We will post the updated policy in the app or at the same URL. The "Last updated" date at the top will be revised. Continued use of the app after changes constitutes acceptance of the updated policy.',
  },
  {
    title: '10. Contact Us',
    body: 'If you have questions about this Privacy Policy or your data, please contact us at: support@todaycheck.app (or replace with your preferred contact email).',
  },
];
