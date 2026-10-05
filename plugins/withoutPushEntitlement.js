// expo-notifications always adds the iOS Push Notifications capability (aps-environment).
// Free Apple "Personal Team" accounts can't sign it, and My Closet only schedules local
// reminders, which don't need it. Remove this plugin once remote push is actually wanted.
// Mods run in reverse plugin order, so app.json must list this *before* expo-notifications.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
