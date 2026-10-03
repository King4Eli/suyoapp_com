import type { LocationGenerator } from "./LocationGenerator.ts";

export type UserRow = Awaited<ReturnType<UserMapper["toUserRow"]>>;
export type Interest = { id: string; name: string; emoji: string };
export type Prompt = { id: string; question: string; answer: string };

const rnd = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rint = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// Tinder user → DB rows. Fields Tinder lacks get plausible random values.
export class UserMapper {
  private readonly locations: LocationGenerator;

  constructor(locations: LocationGenerator) {
    this.locations = locations;
  }

  async toUserRow(u: any, uploadedPhotoPaths: string[] = []) {
    const geo = await this.locations.random();
    const dob = new Date(u.birth_date);
    const dobStr =
      `${dob.getUTCFullYear()}` +
      `${String(dob.getUTCMonth() + 1).padStart(2, "0")}` +
      `${String(dob.getUTCDate()).padStart(2, "0")}`;

    const bio = (u.bio ?? "").slice(0, 400);
    const school = UserMapper.asString(u.schools?.[0]?.name)?.slice(0, 50) ?? null;
    const job    = UserMapper.asString(u.jobs?.[0]?.title)?.slice(0, 20) ?? null;

    const height = UserMapper.descriptorValue(u, "Height");
    const education = UserMapper.mapEducation(UserMapper.descriptorValue(u, "Education"));
    const drinking = UserMapper.mapDrinking(UserMapper.descriptorValue(u, "Drinking"));
    const smoking = UserMapper.mapSmoking(UserMapper.descriptorValue(u, "Smoking"));
    const childrenVal = UserMapper.descriptorValue(u, "Family Plans");
    const children: "0" | "1" =
      childrenVal && /don'?t want/i.test(childrenVal) ? "1" : "0";
    const hasPet: "0" | "1" = UserMapper.descriptorValue(u, "Pets") ? "1" : "0";

    return {
      userId: u._id as string,
      userEmail: null,
      userPhonenumber: UserMapper.randomPhone(),
      userPhonenumberMeta: null,
      userFullname: u.name ?? "Unknown",
      userImage: JSON.stringify(uploadedPhotoPaths.map((p, o) => ({ p, o }))),
      userActive: "1" as const,
      userDeletedDate: null,
      userDeleteData: null,
      geoMeta: geo.meta,
      geoHash: geo.hash,
      geoLong: geo.lng,
      geoLatd: geo.lat,
      userVerified: u.badges?.some((b: any) => b.type === "selfie_verified")
        ? ("1" as const)
        : ("0" as const),
      userSignedupDeviceStats: UserMapper.randomDeviceStats(),
      userBioHighesteducation: education,
      userBioRelationshipgoal: null,
      userBioSchoolattended: school,
      userBioPoliticalview: null,
      userBioHometown: null,
      userBioLanguage: null,
      userBioCompany: job,
      userBioEthnicity: null,
      userBioSmoking: smoking,
      userBioDrinking: drinking,
      userBioChildren: children,
      userBioReligion: null,
      userBioJobrole: job,
      userBioGender: UserMapper.mapGender(u.gender),
      userBioHaspet: hasPet,
      userBioAbout: bio,
      userBioHeight: typeof height === "number" ? height : null,
      userBioDob: dobStr,
      userBioSocialLinks: null,
    };
  }

  static interests(u: any): Interest[] {
    const raw = u.experiment_info?.user_interests?.selected_interests ?? [];
    return raw.map((i: any) => ({
      id: i.id as string,
      name: i.name as string,
      emoji: (i.emoji ?? "") as string,
    }));
  }

  static prompts(u: any): Prompt[] {
    const raw = u.user_prompts?.prompts ?? [];
    return raw.map((p: any) => ({
      id: p.id as string,
      question: p.question_text as string,
      answer: p.answer_text as string,
    }));
  }

  /** Coerce possibly-nested string-ish values (jobs/schools) into a string. */
  private static asString(v: unknown): string | null {
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      const anyV = v as Record<string, unknown>;
      // Tinder often nests the human-readable value under `.name`
      if (typeof anyV.name === "string") return anyV.name;
    }
    return null;
  }

  private static descriptorValue(user: any, name: string): any {
    const d = (user.selected_descriptors ?? []).find(
      (x: any) => x.name === name,
    );
    if (!d) return undefined;
    if (d.type === "measurement") return d.measurable_selection?.value;
    return d.choice_selections?.[0]?.name;
  }

  private static mapGender(g: unknown): number {
    if (g === 1) return 0; // woman
    if (g === 2) return 1; // man
    return 0;
  }

  private static mapEducation(name?: string): number | null {
    if (!name) return null;
    const map: Record<string, number> = {
      "High School": 1,
      "Trade School": 7,
      Bachelors: 2,
      Masters: 3,
      PhD: 4,
    };
    return map[name] ?? null;
  }

  private static mapDrinking(name?: string): "0" | "1" | "2" {
    if (!name) return "1";
    if (/never/i.test(name)) return "0";
    if (/social/i.test(name)) return "1";
    if (/often|frequent/i.test(name)) return "2";
    return "1";
  }

  private static mapSmoking(name?: string): "0" | "1" | "2" {
    if (!name) return "0";
    if (/never|non/i.test(name)) return "0";
    if (/social/i.test(name)) return "1";
    if (/regular|chain|often/i.test(name)) return "2";
    return "0";
  }

  private static randomPhone(): string {
    return `+1${rint(200, 999)}${rint(100, 999)}${rint(1000, 9999)}`;
  }

  private static randomDeviceStats(): string {
    return JSON.stringify({
      os: rnd(["iOS_17.4", "Android_14", "iOS_18.1", "Android_15"]),
      model: rnd(["iPhone 15 Pro", "Pixel 8", "Galaxy S24", "iPhone 14"]),
      app_version: rnd(["7.36.2", "7.35.0", "7.34.1"]),
      is_emulator: false,
    });
  }
}
