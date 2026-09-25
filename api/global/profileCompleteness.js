// How complete a profile is, and exactly what's missing. Computed on the server
// from the stored profile so every client shows the same number, and each item
// says where in the app it's fixed (`action` maps to an edit screen).
//
// Only fields that can actually be left empty count. Smoking / drinking /
// children / pets are NOT NULL columns with defaults, so "unanswered" can't be
// told apart from a real answer -- they're left out rather than always scored.
// Verification counts once the selfie is approved; half while it's under review.

/** @param {any} v */
const filled = (v) =>
  v !== null &&
  v !== undefined &&
  String(v).trim() !== "" &&
  String(v) !== "-99" &&
  !(Array.isArray(v) && v.length === 0);

/**
 * @typedef {"editprofile" | "prompts" | "interests" | "verify"} CompletenessAction
 * @typedef {{
 *   key: string; label: string; hint: string; weight: number;
 *   progress: number; done: boolean; action: CompletenessAction;
 * }} CompletenessItem
 */

/**
 * @param {{ images: any[]; bio: Record<string, any>; verification?: string }} profile
 *   verification: "verified" | "pending" | "rejected" | "none" (global/verification.js)
 * @returns {{ percent: number; items: CompletenessItem[]; missing: CompletenessItem[] }}
 */
export function computeProfileCompleteness({ images, bio, verification }) {
  const photoCount = (Array.isArray(images) ? images : []).filter(
    (img) => img?.p,
  ).length;
  const aboutLength = String(bio?.about ?? "").trim().length;
  const promptCount = (Array.isArray(bio?.prompts) ? bio.prompts : []).filter(
    (p) => String(p?.answer ?? "").trim().length > 0,
  ).length;
  // Interests arrive grouped by category: [{ category, items: [...] }]
  const interestCount = (
    Array.isArray(bio?.interests) ? bio.interests : []
  ).reduce(
    (sum, group) =>
      sum + (Array.isArray(group?.items) ? group.items.length : group ? 1 : 0),
    0,
  );
  /** @param {any[]} values */
  const share = (values) => values.filter(filled).length / values.length;

  /** @type {Omit<CompletenessItem, "done">[]} */
  const raw = [
    {
      key: "photos",
      label: "Photos",
      hint:
        photoCount === 0
          ? "Add at least 3 photos"
          : `Add ${Math.max(0, 3 - photoCount)} more photo${3 - photoCount === 1 ? "" : "s"}`,
      weight: 20,
      progress: Math.min(photoCount, 3) / 3,
      action: "editprofile",
    },
    {
      key: "about",
      label: "About you",
      hint:
        aboutLength === 0
          ? "Write a short bio"
          : "Add a little more to your bio (30+ characters)",
      weight: 15,
      progress: aboutLength >= 30 ? 1 : aboutLength > 0 ? 0.5 : 0,
      action: "editprofile",
    },
    {
      key: "prompts",
      label: "Prompts",
      hint: `Answer ${Math.max(0, 3 - promptCount)} more prompt${3 - promptCount === 1 ? "" : "s"}`,
      weight: 20,
      progress: Math.min(promptCount, 3) / 3,
      action: "prompts",
    },
    {
      key: "interests",
      label: "Interests",
      hint: `Pick ${Math.max(0, 3 - interestCount)} more interest${3 - interestCount === 1 ? "" : "s"}`,
      weight: 10,
      progress: Math.min(interestCount, 3) / 3,
      action: "interests",
    },
    {
      key: "work",
      label: "Work & education",
      hint: "Add your job, education level and school",
      weight: 10,
      progress: share([
        filled(bio?.jobrole) || filled(bio?.company) ? 1 : null,
        bio?.education,
        bio?.school,
      ]),
      action: "editprofile",
    },
    {
      key: "basics",
      label: "Basics",
      hint: "Add your height, what you're looking for and hometown",
      weight: 10,
      progress: share([bio?.height, bio?.relationshipgoal, bio?.hometown]),
      action: "editprofile",
    },
    {
      key: "verified",
      label: "Verify your profile",
      hint:
        verification === "pending"
          ? "Your selfie is being reviewed"
          : verification === "rejected"
            ? "Your last selfie wasn't approved -- try again"
            : "Take a quick selfie to get the verified badge",
      weight: 10,
      progress:
        verification === "verified" ? 1 : verification === "pending" ? 0.5 : 0,
      action: "verify",
    },
    {
      key: "background",
      label: "Background",
      hint: "Add your languages, religion, ethnicity and politics",
      weight: 5,
      progress: share([
        bio?.language,
        bio?.religion,
        bio?.ethnicity,
        bio?.politicalview,
      ]),
      action: "editprofile",
    },
  ];

  const items = raw.map((item) => ({ ...item, done: item.progress >= 1 }));
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  const earned = items.reduce((sum, i) => sum + i.weight * i.progress, 0);
  const percent = Math.round((earned / total) * 100);
  return {
    percent,
    items,
    // Biggest wins first, so the app can lead with the most useful suggestion.
    missing: items
      .filter((i) => !i.done)
      .sort(
        (a, b) => b.weight * (1 - b.progress) - a.weight * (1 - a.progress),
      ),
  };
}
