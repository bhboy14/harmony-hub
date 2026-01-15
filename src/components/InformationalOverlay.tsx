import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Cloud,
  Sun,
  Moon,
  CloudRain,
  Wind,
  Thermometer,
  Clock,
  Bell,
  StickyNote,
  Plus,
  X,
  Edit2,
  Maximize2,
  Minimize2,
  Settings,
} from "lucide-react";
import { format } from "date-fns";

interface WeatherData {
  temp: number;
  condition: string;
  humidity: number;
  wind: number;
  icon: string;
  location: string;
}

interface Memo {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  priority: "low" | "medium" | "high";
}

interface InformationalOverlayProps {
  nextPrayer?: string;
  timeUntilNextPrayer?: string;
  prayerTimes?: { name: string; time: string }[];
  isVisible?: boolean;
  onToggle?: () => void;
}

const MEMOS_KEY = "office_memos";
const WEATHER_CACHE_KEY = "weather_cache";

export const InformationalOverlay = ({
  nextPrayer,
  timeUntilNextPrayer,
  prayerTimes = [],
  isVisible = true,
  onToggle,
}: InformationalOverlayProps) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [memos, setMemos] = useState<Memo[]>(() => {
    const saved = localStorage.getItem(MEMOS_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [isAddingMemo, setIsAddingMemo] = useState(false);
  const [newMemoTitle, setNewMemoTitle] = useState("");
  const [newMemoContent, setNewMemoContent] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Persist memos
  useEffect(() => {
    localStorage.setItem(MEMOS_KEY, JSON.stringify(memos));
  }, [memos]);

  // Fetch weather data
  const fetchWeather = useCallback(async () => {
    // Check cache first
    const cached = localStorage.getItem(WEATHER_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // Cache for 30 minutes
      if (Date.now() - timestamp < 30 * 60 * 1000) {
        setWeather(data);
        return;
      }
    }

    try {
      // Get location from stored settings
      const savedLocation = localStorage.getItem("prayerLocation");
      let city = "Manama";
      if (savedLocation) {
        const parsed = JSON.parse(savedLocation);
        city = parsed.city || "Manama";
      }

      // Using a free weather API (wttr.in)
      const response = await fetch(
        `https://wttr.in/${city}?format=j1`
      );
      
      if (response.ok) {
        const data = await response.json();
        const current = data.current_condition[0];
        
        const weatherData: WeatherData = {
          temp: parseInt(current.temp_C),
          condition: current.weatherDesc[0].value,
          humidity: parseInt(current.humidity),
          wind: parseInt(current.windspeedKmph),
          icon: current.weatherCode,
          location: city,
        };
        
        setWeather(weatherData);
        localStorage.setItem(
          WEATHER_CACHE_KEY,
          JSON.stringify({ data: weatherData, timestamp: Date.now() })
        );
      }
    } catch (error) {
      console.error("Failed to fetch weather:", error);
      // Use cached data even if stale
      if (cached) {
        setWeather(JSON.parse(cached).data);
      }
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    // Refresh weather every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  // Add new memo
  const addMemo = useCallback(() => {
    if (!newMemoTitle.trim()) return;

    const memo: Memo = {
      id: Date.now().toString(),
      title: newMemoTitle.trim(),
      content: newMemoContent.trim(),
      createdAt: Date.now(),
      priority: "medium",
    };

    setMemos((prev) => [memo, ...prev]);
    setNewMemoTitle("");
    setNewMemoContent("");
    setIsAddingMemo(false);
  }, [newMemoTitle, newMemoContent]);

  // Delete memo
  const deleteMemo = useCallback((id: string) => {
    setMemos((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Update memo priority
  const cyclePriority = useCallback((id: string) => {
    setMemos((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const priorities: Memo["priority"][] = ["low", "medium", "high"];
        const currentIndex = priorities.indexOf(m.priority);
        const nextIndex = (currentIndex + 1) % priorities.length;
        return { ...m, priority: priorities[nextIndex] };
      })
    );
  }, []);

  // Get weather icon component
  const getWeatherIcon = (code: string) => {
    const codeNum = parseInt(code);
    if (codeNum >= 200 && codeNum < 300) return <CloudRain className="h-8 w-8" />;
    if (codeNum >= 300 && codeNum < 600) return <CloudRain className="h-8 w-8" />;
    if (codeNum >= 600 && codeNum < 700) return <Cloud className="h-8 w-8" />;
    if (codeNum === 800) {
      const hour = new Date().getHours();
      return hour >= 6 && hour < 18 ? (
        <Sun className="h-8 w-8 text-yellow-400" />
      ) : (
        <Moon className="h-8 w-8 text-blue-300" />
      );
    }
    return <Cloud className="h-8 w-8" />;
  };

  // Get priority color
  const getPriorityColor = (priority: Memo["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-red-500/20 text-red-400 border-red-500/50";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
      case "low":
        return "bg-green-500/20 text-green-400 border-green-500/50";
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
        isExpanded ? "w-96" : "w-80"
      }`}
    >
      <Card className="bg-background/80 backdrop-blur-xl border-border/50 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-lg font-mono font-semibold">
              {format(currentTime, "HH:mm:ss")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            {onToggle && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onToggle}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className={isExpanded ? "h-[500px]" : "h-auto"}>
          <div className="p-3 space-y-4">
            {/* Weather Section */}
            {weather && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getWeatherIcon(weather.icon)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{weather.temp}°C</span>
                      <Badge variant="outline" className="text-xs">
                        {weather.location}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {weather.condition}
                    </span>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1 justify-end">
                    <Wind className="h-3 w-3" />
                    {weather.wind} km/h
                  </div>
                  <div className="flex items-center gap-1 justify-end">
                    <Thermometer className="h-3 w-3" />
                    {weather.humidity}%
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Next Prayer */}
            {nextPrayer && (
              <div className="bg-primary/10 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Next Prayer</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold">{nextPrayer}</span>
                  <Badge variant="secondary" className="text-sm">
                    {timeUntilNextPrayer}
                  </Badge>
                </div>
              </div>
            )}

            {/* All Prayer Times (expanded view) */}
            {isExpanded && prayerTimes.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Today's Prayer Times
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {prayerTimes.map((prayer) => (
                      <div
                        key={prayer.name}
                        className={`flex items-center justify-between p-2 rounded-lg ${
                          prayer.name === nextPrayer
                            ? "bg-primary/20"
                            : "bg-muted/30"
                        }`}
                      >
                        <span className="text-sm">{prayer.name}</span>
                        <span className="text-sm font-mono">{prayer.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Memos Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Office Memos</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsAddingMemo(!isAddingMemo)}
                >
                  {isAddingMemo ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Add Memo Form */}
              {isAddingMemo && (
                <div className="space-y-2 p-2 bg-muted/30 rounded-lg">
                  <Input
                    placeholder="Memo title..."
                    value={newMemoTitle}
                    onChange={(e) => setNewMemoTitle(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Textarea
                    placeholder="Details (optional)..."
                    value={newMemoContent}
                    onChange={(e) => setNewMemoContent(e.target.value)}
                    className="text-sm min-h-[60px]"
                  />
                  <Button
                    size="sm"
                    onClick={addMemo}
                    disabled={!newMemoTitle.trim()}
                    className="w-full"
                  >
                    Add Memo
                  </Button>
                </div>
              )}

              {/* Memo List */}
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {memos.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No memos yet
                  </p>
                ) : (
                  memos.map((memo) => (
                    <div
                      key={memo.id}
                      className={`p-2 rounded-lg border ${getPriorityColor(
                        memo.priority
                      )}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {memo.title}
                          </p>
                          {memo.content && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {memo.content}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => cyclePriority(memo.id)}
                            title="Change priority"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => deleteMemo(memo.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-2 border-t border-border/50 flex justify-between items-center text-xs text-muted-foreground">
          <span>{format(currentTime, "EEEE, MMMM d")}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={fetchWeather}
          >
            Refresh
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default InformationalOverlay;
