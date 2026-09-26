import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { countBadges, rememberBadgeCounts } from "../../global/badges.js";

/**
 * Bottom-tab badge counts (capped at 10, shown as "9+"). The app calls this on
 * launch/foreground; after that the server pushes changes as "badge-counts".
 */
export default async function getBadgeCounts() {
  /** @type {any} */
  const response = { code: 200, message: "ok", likes: 0, chats: 0 };
  try {
    const counts = await countBadges(sessions.currentUserID);
    await rememberBadgeCounts(sessions.currentUserID, counts);
    Object.assign(response, counts);
  } catch (err) {
    tools.serverLog(`Error in getBadgeCounts: ${err}`, "getBadgeCounts-1");
    response.code = 500;
    response.message = "Couldn't load counts.";
  }
  return response;
}
