import { runtime } from "@/config/runtime";

export interface WorkloadSummary {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt: string;
}

export interface ArchiveSummary {
  id: string;
  name: string;
  ownerEmail: string | null;
  publishedAt: string;
  updatedAt: string;
}

export interface WorkloadDetail {
  id: string;
  name: string;
  payload: unknown;
  ownerSub: string;
  ownerEmail: string | null;
  createdAt?: string;
  updatedAt: string;
  publishedAt: string | null;
  readOnly: boolean;
}

function url(path: string): string {
  return `${runtime.apiBaseUrl}${path}`;
}

async function request<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(url(path), {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${accessToken}`,
      "content-type": init.body ? "application/json" : "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text)?.error ?? text;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, message || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const workloadApi = {
  save(accessToken: string, id: string, name: string, payload: unknown) {
    return request<{ id: string; name: string; updatedAt: string; createdAt: string }>(
      accessToken,
      `/workloads/${encodeURIComponent(id)}`,
      { method: "PUT", body: JSON.stringify({ name, payload }) }
    );
  },
  load(accessToken: string, id: string) {
    return request<WorkloadDetail>(
      accessToken,
      `/workloads/${encodeURIComponent(id)}`
    );
  },
  listMine(accessToken: string) {
    return request<{ workloads: WorkloadSummary[] }>(accessToken, "/workloads");
  },
  publish(accessToken: string, id: string) {
    return request<{ id: string; publishedAt: string; updatedAt: string }>(
      accessToken,
      `/workloads/${encodeURIComponent(id)}/publish`,
      { method: "POST" }
    );
  },
  listArchive(accessToken: string) {
    return request<{ workloads: ArchiveSummary[] }>(accessToken, "/archive");
  },
};
