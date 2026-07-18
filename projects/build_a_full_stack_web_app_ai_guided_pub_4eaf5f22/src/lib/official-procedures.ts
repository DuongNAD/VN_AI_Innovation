const DVC_BASE_URL = 'https://dichvucong.gov.vn';

/**
 * Stable public information pages on the current National Public Service Portal.
 * These links are for reading procedure details. Submission remains a separate
 * portal flow because the responsible authority depends on the citizen's locality.
 */
export const OFFICIAL_PROCEDURE_SOURCE_URLS = {
  MARRIAGE_REGISTRATION:
    `${DVC_BASE_URL}/thu-tuc-hanh-chinh/019d2bfd-3fac-7489-b53b-a15eb239a6fe`,
  BIRTH_REGISTRATION:
    `${DVC_BASE_URL}/thu-tuc-hanh-chinh/019d2bfd-3fe0-70ac-b9d6-5e9e20d6eef7`,
  // Divorce is resolved by a competent court, not through the National Public
  // Service Portal. This official court template also lists the usual exhibits.
  DIVORCE_RESOLUTION:
    'https://langson.toaan.gov.vn/webcenter/ShowProperty?nodeId=%2FUCMServer%2FTAND368326',
  TEMP_RESIDENCE_REGISTRATION:
    `${DVC_BASE_URL}/thu-tuc-hanh-chinh/019d2bf7-770b-734d-b7fb-5e1995f194f4`,
  // The demo currently combines the under-14 and 14-or-older procedures, so
  // link to the official result list instead of selecting the wrong age case.
  CITIZEN_ID_ISSUANCE:
    `${DVC_BASE_URL}/dvc-ket-qua-thu-tuc?keyword=C%E1%BA%A5p+th%E1%BA%BB+c%C4%83n+c%C6%B0%E1%BB%9Bc`,
  PASSPORT_ISSUANCE:
    `${DVC_BASE_URL}/thu-tuc-hanh-chinh/019d2bf7-5fda-7370-bc07-6f1fd02ffcc4`,
  HOUSEHOLD_BUSINESS_REGISTRATION:
    `${DVC_BASE_URL}/thu-tuc-hanh-chinh/019d2bfb-d76d-737f-81b9-69258b07240b`,
} as const;

export type OfficialProcedureCode = keyof typeof OFFICIAL_PROCEDURE_SOURCE_URLS;

export function getOfficialProcedureSourceUrl(code: string): string | null {
  return Object.prototype.hasOwnProperty.call(OFFICIAL_PROCEDURE_SOURCE_URLS, code)
    ? OFFICIAL_PROCEDURE_SOURCE_URLS[code as OfficialProcedureCode]
    : null;
}
