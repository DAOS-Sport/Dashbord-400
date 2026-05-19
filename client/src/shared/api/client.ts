export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const apiGet = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    credentials: "include",
  });

  if (!res.ok) {
    const message = (await res.text()) || res.statusText;
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
};

export const apiPost = async <T>(url: string, body?: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { Accept: "application/json", "Content-Type": "application/json" } : { Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const message = (await res.text()) || res.statusText;
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
};

export const apiPut = async <T>(url: string, body?: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: "PUT",
    headers: body ? { Accept: "application/json", "Content-Type": "application/json" } : { Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const message = (await res.text()) || res.statusText;
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
};

export const apiPatch = async <T>(url: string, body?: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: "PATCH",
    headers: body ? { Accept: "application/json", "Content-Type": "application/json" } : { Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const message = (await res.text()) || res.statusText;
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
};

export const apiDelete = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Accept: "application/json" },
    credentials: "include",
  });

  if (!res.ok) {
    const message = (await res.text()) || res.statusText;
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
};
