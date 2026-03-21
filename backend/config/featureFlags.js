/**
 * config/featureFlags.js — Runtime feature flags
 *
 * All new features default to OFF (false).
 * Can be toggled at runtime via admin API without restarting the server.
 * This is a singleton module — all require() calls share the same object.
 */

const featureFlags = {
  AGENT_SYSTEM_ENABLED: false,
};

module.exports = featureFlags;
