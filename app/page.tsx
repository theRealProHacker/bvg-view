"use client";

import { useState, useEffect } from "react";
import { Search, Clock, MapPin, Train, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Stop, Departure } from "@/lib/types";
import { useRecentStations } from "@/hooks/use-recent-stations";

interface DepartureWithStation extends Departure {
  stationName: string;
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedStops, setSelectedStops] = useState<Stop[]>([]);
  const [departures, setDepartures] = useState<Record<string, Departure[]>>({});
  const [loading, setLoading] = useState(false);
  const [departuresLoading, setDeparturesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { recentStations, addRecentStation, clearRecentStations } = useRecentStations();

  const searchStops = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setError(null);
    setStops([]);
    
    try {
      const response = await fetch(`/api/stops?query=${encodeURIComponent(searchQuery.trim())}`);
      if (!response.ok) {
        throw new Error("Failed to fetch stops");
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setStops(data);
    } catch (error) {
      console.error("Error fetching stops:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch stops");
    } finally {
      setLoading(false);
    }
  };

  const getDepartures = async (stopId: string) => {
    setDeparturesLoading(true);
    try {
      const response = await fetch(`/api/departures?stopId=${stopId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch departures");
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setDepartures(prev => ({ ...prev, [stopId]: data }));
    } catch (error) {
      console.error("Error fetching departures:", error);
    } finally {
      setDeparturesLoading(false);
    }
  };

  const getTransitColor = (type: string) => {
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
  };

  const formatTime = (when: string | null) => {
    if (!when) return 'N/A';
    
    const departure = new Date(when);
    const now = new Date();
    const diffMinutes = Math.floor((departure.getTime() - now.getTime()) / 60000);
    
    if (diffMinutes <= 0) {
      return <span className="font-bold">NOW</span>;
    }
    
    if (diffMinutes < 60) {
      return `${diffMinutes} min`;
    }
    
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  // Combine all departures into a single sorted list
  const getAllDepartures = (): DepartureWithStation[] => {
    const allDepartures: DepartureWithStation[] = [];
    
    selectedStops.forEach(stop => {
      const stopDepartures = departures[stop.id] || [];
      stopDepartures.forEach(departure => {
        allDepartures.push({
          ...departure,
          stationName: stop.name
        });
      });
    });

    return allDepartures.sort((a, b) => {
      const timeA = a.when ? new Date(a.when).getTime() : Infinity;
      const timeB = b.when ? new Date(b.when).getTime() : Infinity;
      return timeA - timeB;
    });
  };

  useEffect(() => {
    const updateDepartures = () => {
      selectedStops.forEach(stop => getDepartures(stop.id));
    };

    // Initial fetch
    updateDepartures();

    // Set up interval for updates
    const interval = setInterval(updateDepartures, 10_000);
    return () => clearInterval(interval);
  }, [selectedStops]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto sm:px-4 py-4 sm:py-8">
        <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8" style={{ minWidth: "300px" }}>
          <div className="text-center space-y-4">
            <Train className="w-16 h-16 mx-auto text-primary" />
            <h1 className="text-4xl font-bold text-primary">BVG View</h1>
            <p className="text-muted-foreground px-2">
              Track multiple stations in Berlin&apos;s public transport network
            </p>
          </div>

          {/* Search */}
          <Card className="p-2 border-0 sm:border sm:p-6 shadow-none sm:shadow-sm">
            <form onSubmit={searchStops} className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search for stations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                  disabled={loading}
                />
                <Button type="submit" disabled={loading || !searchQuery.trim()}>
                  {loading ? (
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  Search
                </Button>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              {stops.length > 0 && (
                <div className="space-y-2">
                  {stops.map((stop) => (
                    <Button
                      key={stop.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        if (!selectedStops.find(s => s.id === stop.id)) {
                          setSelectedStops(prev => [...prev, stop]);
                          addRecentStation(stop);
                          getDepartures(stop.id);
                          setStops([]);
                          setSearchQuery("");
                        }
                      }}
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      {stop.name}
                    </Button>
                  ))}
                </div>
              )}
            </form>
          </Card>

          {/* Recent Stations */}
          {recentStations.length > 0 && (
            <Card className="px-3 pb-4 pt-2 sm:p-6 sm:pt-4 rounded-none sm:rounded-lg sm:shadow-sm">
              <div className="flex justify-between items-center mb-2 sm:mb-4">
                <h2 className="text-lg font-semibold">Recent Stations</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRecentStations}
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
              <div className="space-y-2">
                {recentStations.map((station) => (
                  <Button
                    key={station.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      if (!selectedStops.find(s => s.id === station.id)) {
                        const stop: Stop = {
                          id: station.id,
                          name: station.name,
                          location: { latitude: 0, longitude: 0 }
                        };
                        setSelectedStops(prev => [...prev, stop]);
                        getDepartures(station.id);
                      }
                    }}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    {station.name}
                  </Button>
                ))}
              </div>
            </Card>
          )}
  
          {/* Departures */}
          {selectedStops.length > 0 && (
            <Card className="border-x-0 sm:border pb-4 pt-2 sm:p-6 sm:pt-4 rounded-none sm:rounded-lg sm:shadow-sm">
              <div className="p-0 ps-3 sm:ps-0 flex flex-wrap flex-row justify-between mb-4 gap-2">
                <h2 className="text-lg font-semibold mr-2">
                  Departures
                </h2>
                <div className="flex flex-wrap">
                  {selectedStops.map((stop) => (
                    <Button
                      key={stop.id}
                      variant="ghost"
                      size="sm"
                      className="pl-0"
                      onClick={() => {
                        setSelectedStops(prev => prev.filter(s => s.id !== stop.id));
                        setDepartures(prev => {
                          const newDepartures = { ...prev };
                          delete newDepartures[stop.id];
                          return newDepartures;
                        });
                      }}
                    >
                      <X className="w-4 h-4 mr-2"/>
                      {stop.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {getAllDepartures().map((departure, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 py-2 sm:py-3 bg-card rounded-none sm:rounded-lg border-y sm:border"
                    style={{
                      borderColor: getTransitColor(departure.type)
                    }}
                  >
                    <div
                      className="h-10 w-10 rounded-full flex flex-shrink-0 items-center justify-center font-semibold text-white me-4"
                      style={{
                        backgroundColor: getTransitColor(departure.type)
                      }}
                    >
                      {departure.line}
                    </div>
                    <div className="flex-auto">
                      <div className="flex flex-wrap items-center">
                        <p className="font-medium me-3">{departure.direction}</p>
                        <span className="text-sm text-muted-foreground">
                          from {departure.stationName}
                        </span>
                      </div>
                      {departure.platform !== 'N/A' && (
                        <p className="text-sm text-muted-foreground">
                          Platform {departure.platform}
                        </p>
                      )}
                    </div>
                    <div className="text-right ms-3">
                      <div className="font-medium">
                        {formatTime(departure.when)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(departure.when).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                {getAllDepartures().length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    {departuresLoading ? "Loading ..." : "No departures found"}
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}