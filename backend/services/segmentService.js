/**
 * services/segmentService.js — User segmentation
 *
 * Segments:
 *   new_user          – registered < 3 days, no deposit
 *   deposited_no_bet  – has deposit, total_bet = 0
 *   high_value        – total_deposit >= 500 or total_bet >= 5000
 *   sleeping          – last_login > 3 days ago (or never logged in and created > 3 days)
 *   agent             – is_agent = 1
 *   active_user       – none of the above special flags
 */

function segmentUser(user) {
  const now = Date.now();
  const createdAt = user.created_at ? new Date(user.created_at).getTime() : now;
  const lastLogin = user.last_login ? new Date(user.last_login).getTime() : createdAt;
  const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);
  const daysSinceLogin = (now - lastLogin) / (1000 * 60 * 60 * 24);

  if (user.is_agent) return "agent";

  if (daysSinceCreation <= 3 && (user.total_deposit || 0) === 0) return "new_user";

  if ((user.total_deposit || 0) > 0 && (user.total_bet || 0) === 0) return "deposited_no_bet";

  if ((user.total_deposit || 0) >= 500 || (user.total_bet || 0) >= 5000) return "high_value";

  if (daysSinceLogin >= 3) return "sleeping";

  return "active_user";
}

module.exports = { segmentUser };
