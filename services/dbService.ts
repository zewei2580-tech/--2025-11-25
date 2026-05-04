import { CanvasItem, DesignRecipe, Playstyle } from '../types';

export interface ProjectSnapshot {
  id: string;
  name: string;
  items: CanvasItem[];
  thumbnail: string;
  updatedAt: number;
}

const DB_NAME = 'ReCreateDB';
const PROJECT_STORE = 'projects';
const RECIPE_STORE = 'recipes';
const PLAYSTYLE_STORE = 'playstyles';
const DB_VERSION = 4; // 提升版本号

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(RECIPE_STORE)) {
        db.createObjectStore(RECIPE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PLAYSTYLE_STORE)) {
        db.createObjectStore(PLAYSTYLE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveSnapshot = async (snapshot: ProjectSnapshot): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROJECT_STORE, 'readwrite');
    const store = transaction.objectStore(PROJECT_STORE);
    const request = store.put(snapshot);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllSnapshots = async (): Promise<ProjectSnapshot[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROJECT_STORE, 'readonly');
    const store = transaction.objectStore(PROJECT_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result as ProjectSnapshot[];
      resolve(results.sort((a, b) => b.updatedAt - a.updatedAt));
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteSnapshot = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROJECT_STORE, 'readwrite');
    const store = transaction.objectStore(PROJECT_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Design Recipe Operations
export const saveRecipe = async (recipe: DesignRecipe): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECIPE_STORE, 'readwrite');
    const store = transaction.objectStore(RECIPE_STORE);
    const request = store.put(recipe);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllRecipes = async (): Promise<DesignRecipe[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECIPE_STORE, 'readonly');
    const store = transaction.objectStore(RECIPE_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result as DesignRecipe[];
      resolve(results.sort((a, b) => b.createdAt - a.createdAt));
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteRecipe = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECIPE_STORE, 'readwrite');
    const store = transaction.objectStore(RECIPE_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Playstyle Operations
export const savePlaystyle = async (playstyle: Playstyle): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PLAYSTYLE_STORE, 'readwrite');
    const store = transaction.objectStore(PLAYSTYLE_STORE);
    const request = store.put(playstyle);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllPlaystyles = async (): Promise<Playstyle[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PLAYSTYLE_STORE, 'readonly');
    const store = transaction.objectStore(PLAYSTYLE_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result as Playstyle[];
      resolve(results.sort((a, b) => b.createdAt - a.createdAt));
    };
    request.onerror = () => reject(request.error);
  });
};

export const deletePlaystyle = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PLAYSTYLE_STORE, 'readwrite');
    const store = transaction.objectStore(PLAYSTYLE_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};