import { useState, useEffect } from 'react';

export function usePadMode(key: 'counter' | 'kitchen' | 'display') {
    const storageKey = `${key}PadMode`;
    const [padMode, setPadMode] = useState(() => localStorage.getItem(storageKey) === 'true');

    useEffect(() => {
        const handleStorageChange = () => {
            setPadMode(localStorage.getItem(storageKey) === 'true');
        };
        
        window.addEventListener(`${storageKey}_changed`, handleStorageChange);
        // Also listen to native storage events if changed from another tab
        window.addEventListener('storage', handleStorageChange);
        
        return () => {
            window.removeEventListener(`${storageKey}_changed`, handleStorageChange);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [storageKey]);

    const togglePadMode = () => {
        const next = !padMode;
        localStorage.setItem(storageKey, next.toString());
        setPadMode(next);
        window.dispatchEvent(new Event(`${storageKey}_changed`));
    };

    return { padMode, togglePadMode };
}
