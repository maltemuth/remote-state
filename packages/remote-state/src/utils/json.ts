export const safeJsonParse = <T>(jsonString: string | null | undefined): T | null => {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString) as T;
  } catch (_error) {
    return null;
  }
};

export const safeJsonStringify = <S = unknown>(obj: S): string | null => {
  if (obj === null || obj === undefined) return null;
  try {
    return JSON.stringify(obj);
  } catch (_error) {
    return null;
  }
};
