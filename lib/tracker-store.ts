import { emptyState, validateState, type State } from "./tracker-core";
import { t } from "./i18n";
const DB = "noah-tracker-private-v1";
function openDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("records");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(
        Error(
          t("Lokal lagring er utilgjengelig. Prøv en vanlig nettleserfane."),
        ),
      );
  });
}
export async function readState() {
  const db = await openDB();
  try {
    return await new Promise<State>((resolve, reject) => {
      const tx = db.transaction("records", "readonly");
      const r = tx.objectStore("records").get("state");
      r.onsuccess = () => {
        try {
          resolve(r.result ? validateState(r.result) : emptyState());
        } catch {
          reject(
            Error(
              t(
                "Lagrede data kunne ikke leses. De er bevart. Gjenopprett fra en sikkerhetskopi.",
              ),
            ),
          );
        }
      };
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function updateState(change: (s: State) => void): Promise<State> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("records", "readwrite");
      let next: State;
      let cause: unknown;
      const store = tx.objectStore("records");
      const request = store.get("state");
      request.onsuccess = () => {
        try {
          next = request.result ? validateState(request.result) : emptyState();
          change(next);
          next.revision++;
          next = validateState(next);
          store.put(next, "state");
        } catch (e) {
          cause = e;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(next);
      tx.onerror = tx.onabort = () =>
        reject(
          cause ??
            Error(
              t(
                "Kunne ikke lagre. Ingen endringer er bekreftet. Sjekk ledig plass og prøv igjen.",
              ),
            ),
        );
    });
  } finally {
    db.close();
  }
}
export async function cacheRead(key: string) {
  try {
    const db = await publicDB();
    return await new Promise<unknown>((resolve) => {
      const tx = db.transaction("cache", "readonly");
      const r = tx.objectStore("cache").get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}
export async function cacheWrite(key: string, data: unknown) {
  try {
    const db = await publicDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction("cache", "readwrite");
      tx.objectStore("cache").put(data, key);
      tx.oncomplete = tx.onabort = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    /* Public cache is optional. Private storage errors must remain visible. */
  }
}
function publicDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("noah-tracker-public-food-cache", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("cache");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
