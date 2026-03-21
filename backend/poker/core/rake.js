/**
 * poker/core/rake.js — Configurable rake calculation
 *
 * Reads rake_percent and rake_cap from DB-backed config.
 * Never hard-coded — all values come from system_configs or room_configs.
 */

function calculateRake(pot, config) {
  const percent = parseFloat(config.rake_percent || "0.05");
  const cap     = parseFloat(config.rake_cap     || "10");

  let rake = pot * percent;
  if (rake > cap) rake = cap;

  // Round to 2 decimal places
  return Math.round(rake * 100) / 100;
}

module.exports = { calculateRake };
