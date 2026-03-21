/**
 * services/triggerService.js — Trigger conditions with priority system
 *
 * Each trigger has:
 *   name     – unique identifier (matches message_templates.trigger)
 *   priority – lower number = higher priority (1 = most important)
 *   match    – function(user, segment) → boolean
 *
 * Feature #7: Only the highest-priority (lowest number) matching trigger fires.
 * Feature #5: 6-hour cooldown — same trigger won't re-send within 6 hours.
 */

const TRIGGERS = [
  {
    name: "high_value",
    priority: 1,
    match: (user, segment) => segment === "high_value",
  },
  {
    name: "register_no_deposit",
    priority: 2,
    match: (user, segment) => {
      if (segment !== "new_user") return false;
      return (user.total_deposit || 0) === 0;
    },
  },
  {
    name: "deposit_no_bet",
    priority: 3,
    match: (user, segment) => {
      return segment === "deposited_no_bet";
    },
  },
  {
    name: "inactive_7d",
    priority: 4,
    match: (user, segment) => {
      if (segment !== "sleeping") return false;
      const lastLogin = user.last_login
        ? new Date(user.last_login).getTime()
        : new Date(user.created_at).getTime();
      const days = (Date.now() - lastLogin) / (1000 * 60 * 60 * 24);
      return days >= 7;
    },
  },
  {
    name: "inactive_3d",
    priority: 5,
    match: (user, segment) => {
      if (segment !== "sleeping") return false;
      const lastLogin = user.last_login
        ? new Date(user.last_login).getTime()
        : new Date(user.created_at).getTime();
      const days = (Date.now() - lastLogin) / (1000 * 60 * 60 * 24);
      return days >= 3;
    },
  },
];

// Sort by priority ascending (most important first)
TRIGGERS.sort((a, b) => a.priority - b.priority);

const COOLDOWN_HOURS = 6;

/**
 * Evaluate all triggers for a user and return the highest-priority match,
 * respecting the 6-hour cooldown for the same trigger.
 *
 * @param {object} user     – user row from DB
 * @param {string} segment  – segment string from segmentService
 * @returns {string|null}   – trigger name or null
 */
function evaluateTrigger(user, segment) {
  const now = Date.now();

  for (const trigger of TRIGGERS) {
    if (!trigger.match(user, segment)) continue;

    // Feature #5: cooldown check — same trigger within 6 hours → skip
    if (user.last_trigger === trigger.name && user.last_push_at) {
      const lastPush = new Date(user.last_push_at).getTime();
      const hoursSince = (now - lastPush) / (1000 * 60 * 60);
      if (hoursSince < COOLDOWN_HOURS) continue;
    }

    // Highest-priority match found
    return trigger.name;
  }

  return null;
}

module.exports = { evaluateTrigger, TRIGGERS, COOLDOWN_HOURS };
