
/**
 * Multi-tenant Store Filter Utility
 * Handles persistent storage and retrieval of store_id and storeName.
 */

const STORAGE_KEYS = {
    STORE_ID: 'situation_store_id',
    STORE_NAME: 'situation_store_name'
};

export const getStoredStoreId = (): string => {
    // 1. URL Query Parameter takes priority
    const params = new URLSearchParams(window.location.search);
    const urlStoreId = params.get('storeId');
    if (urlStoreId) {
        localStorage.setItem(STORAGE_KEYS.STORE_ID, urlStoreId);
        return urlStoreId;
    }

    // 2. Local Storage fallback
    return localStorage.getItem(STORAGE_KEYS.STORE_ID) || '';
};

export const getStoredStoreName = (): string => {
    const params = new URLSearchParams(window.location.search);
    const urlStoreName = params.get('store');
    if (urlStoreName) {
        localStorage.setItem(STORAGE_KEYS.STORE_NAME, urlStoreName);
        return urlStoreName;
    }

    return localStorage.getItem(STORAGE_KEYS.STORE_NAME) || '';
};

export const setStoreInfo = (id: string, name: string) => {
    localStorage.setItem(STORAGE_KEYS.STORE_ID, id);
    localStorage.setItem(STORAGE_KEYS.STORE_NAME, name);
};

export const clearStoreInfo = () => {
    localStorage.removeItem(STORAGE_KEYS.STORE_ID);
    localStorage.removeItem(STORAGE_KEYS.STORE_NAME);
};

/**
 * Filter bundles by store_id. 
 * If currentStoreId is empty or "Total", returns all bundles.
 */
export const filterByStore = (bundles: any[], currentStoreId: string) => {
    if (!currentStoreId || currentStoreId === 'Total') return bundles;
    return bundles.filter(b => b.store_id === currentStoreId || !b.store_id);
};
