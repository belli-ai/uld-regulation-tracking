type LocalPrefsValue =
  | boolean
  | number
  | string
  | string[]
  | Record<string, unknown>
  | null;

const memoryFallback = new Map<string, string>();

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null;
  }

  try {
    const probeKey = '__cool-chain-local-prefs__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch (error) {
    console.warn('localStorage unavailable, using in-memory prefs fallback.', error);
    return null;
  }
}

function readRaw(key: string): string | null {
  const storage = getStorage();

  if (storage) {
    try {
      return storage.getItem(key);
    } catch (error) {
      console.warn(`Failed to read local preference "${key}".`, error);
    }
  }

  return memoryFallback.get(key) ?? null;
}

function writeRaw(key: string, value: string): void {
  const storage = getStorage();

  if (storage) {
    try {
      storage.setItem(key, value);
      memoryFallback.delete(key);
      return;
    } catch (error) {
      console.warn(`Failed to persist local preference "${key}".`, error);
    }
  }

  memoryFallback.set(key, value);
}

function clearRaw(key: string): void {
  const storage = getStorage();

  if (storage) {
    try {
      storage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to clear local preference "${key}".`, error);
    }
  }

  memoryFallback.delete(key);
}

export function getLocalPref<T extends LocalPrefsValue>(
  key: string,
  fallback: T,
): T {
  const raw = readRaw(key);

  if (raw === null) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed to parse local preference "${key}".`, error);
    return fallback;
  }
}

export function setLocalPref<T extends LocalPrefsValue>(
  key: string,
  value: T,
): void {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to serialize local preference "${key}".`, error);
  }
}

export function clearLocalPref(key: string): void {
  clearRaw(key);
}

export const localPrefs = {
  get: getLocalPref,
  set: setLocalPref,
  clear: clearLocalPref,
};
