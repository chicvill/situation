import { useState, useEffect } from 'react';

export function usePadMode() {
    const [padMode, setPadMode] = useState(() => localStorage.getItem('globalPadMode') === 'true');

    useEffect(() => {
        const handleStorageChange = () => {
            setPadMode(localStorage.getItem('globalPadMode') === 'true');
        };
        
        window.addEventListener('pad_mode_changed', handleStorageChange);
        // Also listen to native storage events if changed from another tab
        window.addEventListener('storage', handleStorageChange);
        
        return () => {
            window.removeEventListener('pad_mode_changed', handleStorageChange);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    const togglePadMode = () => {
        const next = !padMode;
        localStorage.setItem('globalPadMode', next.toString());
        setPadMode(next);
        window.dispatchEvent(new Event('pad_mode_changed'));
    };

    return { padMode, togglePadMode };
}
