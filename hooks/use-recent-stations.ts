import { useState, useEffect } from 'react';
import type { RecentStation, Stop } from '@/lib/types';

const MAX_RECENT_STATIONS = 5;
const STORAGE_KEY = 'recentStations';

export function useRecentStations() {
  const [recentStations, setRecentStations] = useState<RecentStation[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setRecentStations(JSON.parse(stored));
    }
  }, []);

  const addRecentStation = (stop: Stop) => {
    const newStation: RecentStation = {
      id: stop.id,
      name: stop.name,
      timestamp: Date.now(),
    };

    setRecentStations((current) => {
      const filtered = current.filter((s) => s.id !== stop.id);
      const updated = [newStation, ...filtered].slice(0, MAX_RECENT_STATIONS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearRecentStations = () => {
    localStorage.removeItem(STORAGE_KEY);
    setRecentStations([]);
  };

  return {
    recentStations,
    addRecentStation,
    clearRecentStations,
  };
}