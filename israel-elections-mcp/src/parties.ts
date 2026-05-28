/**
 * Party ballot-letter → party name lookup, per Knesset.
 *
 * The data.gov.il CSV exposes party vote counts as columns whose name is the
 * ballot letter (אות הרשימה), not the party name. The same letter can map to
 * different parties across elections (e.g. "כן" was Blue and White (Gantz) in
 * K24 and National Unity (Gantz) in K25; "ב" was Yamina in K24 and HaBayit
 * HaYehudi in K25; "פה" was Blue and White (Gantz+Lapid joint) in K23 and Yesh
 * Atid alone in K24/K25).
 *
 * Source: Central Elections Committee final result rosters
 * (https://www.bechirot25.gov.il, .../bechirot24, .../bechirot23).
 *
 * Only parties that received non-trivial vote shares are listed. Unknown codes
 * fall through to displaying the raw ballot letter.
 */

import type { KnessetNumber } from "./client.js";

export interface PartyName {
  he: string;
  en: string;
}

type PartyMap = Record<string, PartyName>;

const K25: PartyMap = {
  מחל: { he: "הליכוד", en: "Likud" },
  פה: { he: "יש עתיד", en: "Yesh Atid" },
  ט: { he: "הציונות הדתית", en: "Religious Zionism" },
  שס: { he: 'ש"ס', en: "Shas" },
  ג: { he: "יהדות התורה", en: "United Torah Judaism" },
  כן: { he: "המחנה הממלכתי", en: "National Unity" },
  ל: { he: "ישראל ביתנו", en: "Yisrael Beiteinu" },
  ום: { he: 'חד"ש-תע"ל', en: "Hadash-Ta'al" },
  עם: { he: 'רע"ם', en: "Ra'am (UAL)" },
  אמת: { he: "העבודה", en: "Labor" },
  מרצ: { he: "מרצ", en: "Meretz" },
  ד: { he: 'בל"ד', en: "Balad" },
  ב: { he: "הבית היהודי", en: "HaBayit HaYehudi" },
};

const K24: PartyMap = {
  מחל: { he: "הליכוד", en: "Likud" },
  פה: { he: "יש עתיד", en: "Yesh Atid" },
  ת: { he: "תקווה חדשה", en: "New Hope" },
  ט: { he: "הציונות הדתית", en: "Religious Zionism" },
  ב: { he: "ימינה", en: "Yamina" },
  ל: { he: "ישראל ביתנו", en: "Yisrael Beiteinu" },
  שס: { he: 'ש"ס', en: "Shas" },
  כן: { he: "כחול לבן", en: "Blue and White" },
  ג: { he: "יהדות התורה", en: "United Torah Judaism" },
  אמת: { he: "העבודה", en: "Labor" },
  מרצ: { he: "מרצ", en: "Meretz" },
  עם: { he: 'רע"ם', en: "Ra'am (UAL)" },
  ודעם: { he: "הרשימה המשותפת", en: "Joint List" },
};

const K23: PartyMap = {
  מחל: { he: "הליכוד", en: "Likud" },
  פה: { he: "כחול לבן", en: "Blue and White" },
  ודעם: { he: "הרשימה המשותפת", en: "Joint List" },
  שס: { he: 'ש"ס', en: "Shas" },
  אמת: { he: "העבודה-גשר-מרצ", en: "Labor-Gesher-Meretz" },
  ג: { he: "יהדות התורה", en: "United Torah Judaism" },
  ל: { he: "ישראל ביתנו", en: "Yisrael Beiteinu" },
  טב: { he: "ימינה", en: "Yamina" },
};

const PARTY_NAMES: Record<KnessetNumber, PartyMap> = {
  23: K23,
  24: K24,
  25: K25,
};

/**
 * Look up the party name for a ballot letter in a given Knesset.
 * Returns null when the code is unknown (small lists that didn't pass the
 * threshold); callers should display the raw code in that case.
 */
export function lookupParty(
  knesset: KnessetNumber,
  code: string,
): PartyName | null {
  return PARTY_NAMES[knesset]?.[code] ?? null;
}

/**
 * Render a party identifier for table cells: "Name (code) / שם" when known,
 * otherwise just the raw code.
 */
export function formatPartyLabel(
  knesset: KnessetNumber,
  code: string,
): string {
  const name = lookupParty(knesset, code);
  if (!name) return code;
  return `${name.en} (${code}) / ${name.he}`;
}
