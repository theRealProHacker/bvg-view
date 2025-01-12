export interface Stop {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

export interface Departure {
  line: string;
  direction: string;
  when: string;
  platform: string;
  type: string;
}

export interface RecentStation {
  id: string;
  name: string;
  timestamp: number;
}