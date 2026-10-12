import { useCallback, useState } from 'react';

/**
 * Boolean remembered in localStorage (per browser profile). Storage can be unavailable
 * (private window, blocked site data): the flag then simply is not remembered.
 */
export function useStoredFlag(key: string, initial = false) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : raw === '1';
    } catch {
      return initial;
    }
  });

  const toggle = useCallback(() => {
    setValue((v) => {
      try {
        localStorage.setItem(key, v ? '0' : '1');
      } catch {
        /* not remembered, still works for this session */
      }
      return !v;
    });
  }, [key]);

  return [value, toggle] as const;
}
