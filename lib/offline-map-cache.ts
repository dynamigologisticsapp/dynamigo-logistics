/**
 * Offline Map Tile Caching Service
 * Stores map tiles in IndexedDB for offline access
 */

const DB_NAME = "dynamigo-logistics-maps";
const STORE_NAME = "tiles";
const DB_VERSION = 1;

interface CachedTile {
  key: string;
  url: string;
  data: Blob;
  timestamp: number;
}

export class OfflineMapCache {
  private db: IDBDatabase | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("Failed to open IndexedDB for map caching");
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
    });
  }

  async cacheTile(url: string, blob: Blob): Promise<void> {
    if (!this.db) await this.init();

    const key = this.generateKey(url);
    const tile: CachedTile = {
      key,
      url,
      data: blob,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(tile);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getTile(url: string): Promise<Blob | null> {
    if (!this.db) await this.init();

    const key = this.generateKey(url);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as CachedTile | undefined;
        resolve(result ? result.data : null);
      };
    });
  }

  async clearCache(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getCacheSize(): Promise<number> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const tiles = request.result as CachedTile[];
        const size = tiles.reduce((acc, tile) => acc + tile.data.size, 0);
        resolve(size);
      };
    });
  }

  async getTileCount(): Promise<number> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  private generateKey(url: string): string {
    // Create a unique key from the URL
    return url.replace(/[^a-zA-Z0-9]/g, "_");
  }
}

// Singleton instance
export const offlineMapCache = new OfflineMapCache();
