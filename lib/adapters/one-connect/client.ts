import "server-only";

type TokenCache = { token: string; expiresAt: number } | null;

type FetchOptions = { embedded?: boolean };

type OneConnectConfig = {
  idpUrl: string;
  apiUrl: string;
  proxyUrl: string;
  taxonApiUrl: string;
  clientId: string;
  clientSecret: string;
  notificationPollMs: number;
  staleMs: number;
};

type TokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
};

const FETCH_TIMEOUT_MS = 8000;
const TOKEN_REFRESH_SKEW_MS = 30_000;

let tokenCache: TokenCache = null;

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`one-connect: missing required env '${name}'`);
  }
  return value;
}

function readRequiredNumberEnv(name: string): number {
  const value = Number(readRequiredEnv(name));
  if (!Number.isFinite(value)) {
    throw new Error(`one-connect: env '${name}' must be a finite number`);
  }
  return value;
}

function getConfig(): OneConnectConfig {
  if (!isOneConnectEnabled()) {
    throw new Error("one-connect: integration is disabled");
  }
  return {
    idpUrl: readRequiredEnv("ONE_CONNECT_IDP_URL"),
    apiUrl: readRequiredEnv("ONE_CONNECT_API_URL"),
    proxyUrl: readRequiredEnv("ONE_CONNECT_PROXY_URL"),
    taxonApiUrl: readRequiredEnv("ONE_CONNECT_TAXON_API_URL"),
    clientId: readRequiredEnv("ONE_CONNECT_CLIENT_ID"),
    clientSecret: readRequiredEnv("ONE_CONNECT_CLIENT_SECRET"),
    notificationPollMs: readRequiredNumberEnv("ONE_CONNECT_NOTIFICATION_POLL_MS"),
    staleMs: readRequiredNumberEnv("ONE_CONNECT_STALE_MS"),
  };
}

function createSignal(): AbortSignal {
  return AbortSignal.timeout(FETCH_TIMEOUT_MS);
}

function appendEmbeddedParam(url: URL, embedded?: boolean): void {
  if (embedded === true) {
    url.searchParams.set("embedded", "true");
  }
}

function buildUrl(input: string, embedded?: boolean): string {
  const config = getConfig();
  const url = new URL(input, config.apiUrl.endsWith("/") ? config.apiUrl : `${config.apiUrl}/`);
  appendEmbeddedParam(url, embedded);
  return url.toString();
}

function mergeHeaders(init?: RequestInit, token?: string): Headers {
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/ld+json");
  }
  return headers;
}

function parseTokenResponse(json: TokenResponse): { token: string; expiresIn: number } {
  if (typeof json.access_token !== "string" || json.access_token.length === 0) {
    throw new Error("one-connect: token response missing access_token");
  }
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : Number(json.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error("one-connect: token response missing expires_in");
  }
  return { token: json.access_token, expiresIn };
}

async function fetchWithBearer(
  url: string,
  init: RequestInit | undefined,
  token: string,
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: mergeHeaders(init, token),
    signal: createSignal(),
  });
}

export function isOneConnectEnabled(): boolean {
  return process.env.ONE_CONNECT_ENABLED === "true";
}

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - TOKEN_REFRESH_SKEW_MS > now) {
    return tokenCache.token;
  }

  const config = getConfig();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(config.idpUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: createSignal(),
  });

  if (!response.ok) {
    throw new Error(`one-connect: token request failed with ${response.status}`);
  }

  const parsed = parseTokenResponse((await response.json()) as TokenResponse);
  tokenCache = {
    token: parsed.token,
    expiresAt: now + parsed.expiresIn * 1000,
  };
  return parsed.token;
}

export async function oneConnectFetch(
  url: string,
  init?: RequestInit,
  opts?: FetchOptions,
): Promise<Response> {
  const requestUrl = buildUrl(url, opts?.embedded);
  const token = await getAccessToken();
  const response = await fetchWithBearer(requestUrl, init, token);
  if (response.status !== 401) {
    return response;
  }

  tokenCache = null;
  const retryToken = await getAccessToken();
  return fetchWithBearer(requestUrl, init, retryToken);
}

export async function getServerInformation(): Promise<unknown> {
  const response = await oneConnectFetch(getConfig().apiUrl);
  if (!response.ok) {
    throw new Error(`one-connect: server information failed with ${response.status}`);
  }
  return response.json();
}

export async function getLogisticsObject(
  uri: string,
  opts?: FetchOptions,
): Promise<unknown> {
  const response = await oneConnectFetch(uri, undefined, opts);
  if (!response.ok) {
    throw new Error(`one-connect: logistics object fetch failed with ${response.status}`);
  }
  return response.json();
}

export async function pollNotifications(opts?: { limit?: number }): Promise<unknown[]> {
  const config = getConfig();
  const url = new URL("notifications", config.proxyUrl.endsWith("/") ? config.proxyUrl : `${config.proxyUrl}/`);
  if (typeof opts?.limit === "number") {
    url.searchParams.set("limit", String(opts.limit));
  }

  const response = await oneConnectFetch(url.toString());
  if (!response.ok) {
    throw new Error(`one-connect: notification poll failed with ${response.status}`);
  }

  const json = await response.json();
  return Array.isArray(json) ? json : [];
}

export async function createSubscription(
  topicUri: string,
): Promise<{ created: boolean; status: number }> {
  const config = getConfig();
  const url = new URL("subscriptions", config.taxonApiUrl.endsWith("/") ? config.taxonApiUrl : `${config.taxonApiUrl}/`);
  const body = {
    "@context": { api: "https://onerecord.iata.org/ns/api#" },
    "@type": "api:Subscription",
    "api:hasSubscriber": `${config.apiUrl}/logistics-objects/DATA_HOLDER`,
    "api:hasTopicType": "https://onerecord.iata.org/ns/api#LOGISTICS_OBJECT_TYPE",
    "api:includeSubscriptionEventType": [
      { "@id": "https://onerecord.iata.org/ns/api#LOGISTICS_OBJECT_CREATED" },
      { "@id": "https://onerecord.iata.org/ns/api#LOGISTICS_OBJECT_UPDATED" },
      { "@id": "https://onerecord.iata.org/ns/api#LOGISTICS_EVENT_RECEIVED" },
    ],
    "api:hasTopic": {
      "@type": "http://www.w3.org/2001/XMLSchema#anyURI",
      "@value": topicUri,
    },
  };

  const response = await oneConnectFetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/ld+json" },
    body: JSON.stringify(body),
  });

  return { created: response.status >= 200 && response.status < 300, status: response.status };
}

export async function postLogisticsObject(
  jsonld: unknown,
): Promise<{ "@id": string | null; status: number }> {
  const config = getConfig();
  const url = new URL("logistics-objects", config.apiUrl.endsWith("/") ? config.apiUrl : `${config.apiUrl}/`);
  const response = await oneConnectFetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/ld+json" },
    body: JSON.stringify(jsonld),
  });

  return { "@id": response.headers.get("Location"), status: response.status };
}
