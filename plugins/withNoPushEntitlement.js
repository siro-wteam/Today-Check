/**
 * Removes the Push Notifications (aps-environment) entitlement from iOS builds.
 * Use this when developing with a Personal/Free Apple Developer team, which does
 * not support Push Notifications. Remove this plugin when you have a paid
 * Apple Developer Program account and want push notifications.
 *
 * @see https://developer.apple.com/support/compare-memberships/
 */

const { withEntitlementsPlist } = require('expo/config-plugins');

function withNoPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
}

module.exports = withNoPushEntitlement;
