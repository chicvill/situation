
import { useState, useCallback, useEffect } from 'react';
import { getStoredStoreId, getStoredStoreName, setStoreInfo as persistStoreInfo } from '../utils/storeFilter';

export const useStoreFilter = () => {
    const [storeId, setStoreId] = useState<string>(getStoredStoreId());
    const [storeName, setStoreName] = useState<string>(getStoredStoreName());

    const updateStore = useCallback((id: string, name: string) => {
        setStoreId(id);
        setStoreName(name);
        persistStoreInfo(id, name);
    }, []);

    // Listen for storage changes (optional, useful for multi-tab sync)
    useEffect(() => {
        const handleStorage = () => {
            setStoreId(getStoredStoreId());
            setStoreName(getStoredStoreName());
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    return {
        storeId,
        storeName,
        updateStore,
        isTotalMode: storeId === 'Total' || !storeId
    };
};
