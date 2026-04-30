const STORAGE_KEY = "dreams_correlation_id";

export const getCorrelationId = (): string => {
  if (typeof window === "undefined") {
    return crypto.randomUUID();
  }
  try {
    let id = window.sessionStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.sessionStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
};

export const resetCorrelationId = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
};
