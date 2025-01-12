import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getTransitTypeColor(type: string): string {
  switch (type.toLowerCase()) {
    case 'subway':
    case 'u-bahn':
      return '#0067C5';
    case 'suburban':
    case 's-bahn':
      return '#006F35';
    case 'bus':
      return '#925CAB';
    default:
      return '#6B7280';
  }
}

export function formatCountdown(when: string | null): string {
  if (!when) return 'N/A';
  
  const departure = new Date(when);
  const now = new Date();
  const diffMinutes = Math.floor((departure.getTime() - now.getTime()) / 60000);
  
  if (diffMinutes <= 0) return 'NOW';
  if (diffMinutes < 60) return `${diffMinutes} min`;
  
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return `${hours} h ${minutes} min`;
}