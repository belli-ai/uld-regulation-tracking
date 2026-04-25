import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";

import type { AcceptanceCheck } from "./types";

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

type DgAutocheckConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  officeIdentifier: string;
  userIdentifier: string;
};

type TokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
};

let tokenCache: TokenCache | null = null;

export class DgAutocheckHttpError extends Error {
  responseText: string;
  status: number;

  constructor(status: number, responseText: string, message: string) {
    super(message);
    this.name = "DgAutocheckHttpError";
    this.responseText = responseText;
    this.status = status;
  }
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required when DG_AUTOCHECK_ENABLED=true`);
  }
  return value;
}

export function getDgAutocheckConfig(): DgAutocheckConfig {
  return {
    baseUrl: readRequiredEnv("DG_AUTOCHECK_BASE_URL").replace(/\/+$/, ""),
    clientId: readRequiredEnv("DG_AUTOCHECK_CLIENT_ID"),
    clientSecret: readRequiredEnv("DG_AUTOCHECK_CLIENT_SECRET"),
    officeIdentifier: readRequiredEnv("DG_AUTOCHECK_OFFICE_IDENTIFIER"),
    userIdentifier:
      process.env.DG_AUTOCHECK_USER_IDENTIFIER?.trim() || "cool-chain-operator",
  };
}

function makeUrl(path: string, baseUrl: string): URL {
  return new URL(path.startsWith("/") ? path : `/${path}`, baseUrl);
}

async function readError(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function requestAccessToken(
  config: DgAutocheckConfig,
): Promise<TokenCache> {
  const url = makeUrl("/oauth2/token", config.baseUrl);
  const form = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "client_credentials",
  }).toString();
  const { body, statusCode } = await new Promise<{
    body: string;
    statusCode: number;
  }>((resolve, reject) => {
    const send = url.protocol === "http:" ? httpRequest : httpsRequest;
    const request = send(
      url,
      {
        headers: {
          accept: "application/json",
          "content-length": Buffer.byteLength(form).toString(),
          "content-type": "application/x-www-form-urlencoded",
        },
        method: "GET",
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          resolve({
            body: Buffer.concat(chunks).toString("utf8"),
            statusCode: response.statusCode ?? 0,
          });
        });
      },
    );
    request.on("error", reject);
    request.end(form);
  });

  if (statusCode < 200 || statusCode >= 300) {
    throw new DgAutocheckHttpError(
      statusCode,
      body,
      `DG AutoCheck token request failed with status ${statusCode}`,
    );
  }

  const payload = JSON.parse(body) as TokenResponse;
  if (typeof payload.access_token !== "string") {
    throw new Error("DG AutoCheck token response did not include access_token");
  }

  const expiresInSeconds =
    typeof payload.expires_in === "number" && payload.expires_in > 60
      ? payload.expires_in
      : 20 * 60;

  return {
    accessToken: payload.access_token,
    expiresAtMs: Date.now() + (expiresInSeconds - 30) * 1000,
  };
}

async function getAccessToken(config: DgAutocheckConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAtMs > Date.now()) {
    return tokenCache.accessToken;
  }

  tokenCache = await requestAccessToken(config);
  return tokenCache.accessToken;
}

export async function dgAutocheckFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const config = getDgAutocheckConfig();
  const token = await getAccessToken(config);
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(makeUrl(path, config.baseUrl), {
    ...init,
    headers,
  });

  if (response.status !== 401) {
    return response;
  }

  tokenCache = null;
  headers.set("authorization", `Bearer ${await getAccessToken(config)}`);
  return fetch(makeUrl(path, config.baseUrl), { ...init, headers });
}

export async function readJsonResponse<T>(
  response: Response,
  action: string,
): Promise<T> {
  if (!response.ok) {
    const responseText = await readError(response);
    const hint =
      response.status === 403 && responseText.length === 0
        ? " Empty 403 from DG AutoCheck usually means the access credential lacks Manage permission or the API Integrator license required for lifecycle endpoints."
        : "";
    throw new DgAutocheckHttpError(
      response.status,
      responseText,
      `DG AutoCheck ${action} failed with status ${response.status}.${hint}`,
    );
  }

  return (await response.json()) as T;
}

export async function readAcceptanceCheckJson(
  response: Response,
  action: string,
): Promise<AcceptanceCheck> {
  const payload = await readJsonResponse<unknown>(response, action);
  if (
    payload == null ||
    typeof payload !== "object" ||
    typeof (payload as { acceptanceCheckId?: unknown }).acceptanceCheckId !==
      "string"
  ) {
    throw new Error(`DG AutoCheck ${action} response did not include an id`);
  }

  return payload as AcceptanceCheck;
}
