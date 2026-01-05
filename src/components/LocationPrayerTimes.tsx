import { useState, useEffect } from "react";
import { MapPin, RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface LocationPrayerTimesProps {
  onTimesUpdate: (times: PrayerTimeData[]) => void;
  onLocationChange?: (location: { country: string; city: string }) => void;
}

export interface PrayerTimeData {
  name: string;
  arabicName: string;
  time: string;
}

// Common countries with Islamic population
const COUNTRIES = [
  { code: "SA", name: "Saudi Arabia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "EG", name: "Egypt" },
  { code: "TR", name: "Turkey" },
  { code: "PK", name: "Pakistan" },
  { code: "ID", name: "Indonesia" },
  { code: "MY", name: "Malaysia" },
  { code: "BD", name: "Bangladesh" },
  { code: "IN", name: "India" },
  { code: "IQ", name: "Iraq" },
  { code: "JO", name: "Jordan" },
  { code: "KW", name: "Kuwait" },
  { code: "QA", name: "Qatar" },
  { code: "BH", name: "Bahrain" },
  { code: "OM", name: "Oman" },
  { code: "MA", name: "Morocco" },
  { code: "DZ", name: "Algeria" },
  { code: "TN", name: "Tunisia" },
  { code: "LY", name: "Libya" },
  { code: "SD", name: "Sudan" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
];

// Popular cities by country
const CITIES_BY_COUNTRY: Record<string, string[]> = {
  SA: ["Mecca", "Medina", "Riyadh", "Jeddah", "Dammam", "Taif"],
  AE: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Fujairah", "Ras Al Khaimah"],
  EG: ["Cairo", "Alexandria", "Giza", "Luxor", "Aswan", "Port Said"],
  TR: ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Konya"],
  PK: ["Karachi", "Lahore", "Islamabad", "Faisalabad", "Peshawar", "Multan"],
  ID: ["Jakarta", "Surabaya", "Bandung", "Medan", "Yogyakarta", "Bali"],
  MY: ["Kuala Lumpur", "Penang", "Johor Bahru", "Malacca", "Kota Kinabalu"],
  BD: ["Dhaka", "Chittagong", "Khulna", "Sylhet", "Rajshahi"],
  IN: ["Mumbai", "Delhi", "Hyderabad", "Lucknow", "Kolkata", "Chennai"],
  IQ: ["Baghdad", "Basra", "Mosul", "Erbil", "Najaf", "Karbala"],
  JO: ["Amman", "Zarqa", "Irbid", "Aqaba", "Madaba"],
  KW: ["Kuwait City", "Hawalli", "Farwaniya", "Ahmadi"],
  QA: ["Doha", "Al Wakrah", "Al Khor", "Dukhan"],
  BH: ["Manama", "Muharraq", "Riffa", "Hamad Town"],
  OM: ["Muscat", "Salalah", "Sohar", "Nizwa"],
  MA: ["Casablanca", "Rabat", "Marrakech", "Fez", "Tangier"],
  DZ: ["Algiers", "Oran", "Constantine", "Annaba"],
  TN: ["Tunis", "Sfax", "Sousse", "Kairouan"],
  LY: ["Tripoli", "Benghazi", "Misrata"],
  SD: ["Khartoum", "Omdurman", "Port Sudan"],
  US: ["New York", "Los Angeles", "Chicago", "Houston", "Dallas", "Detroit", "Philadelphia"],
  GB: ["London", "Birmingham", "Manchester", "Leeds", "Bradford"],
  CA: ["Toronto", "Montreal", "Vancouver", "Calgary", "Ottawa"],
  AU: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"],
  DE: ["Berlin", "Munich", "Frankfurt", "Hamburg", "Cologne"],
  FR: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice"],
};

export const LocationPrayerTimes = ({ onTimesUpdate, onLocationChange }: LocationPrayerTimesProps) => {
  const [country, setCountry] = useState(() => localStorage.getItem('prayerCountry') || "SA");
  const [city, setCity] = useState(() => localStorage.getItem('prayerCity') || "Mecca");
  const [customCity, setCustomCity] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const { toast } = useToast();

  const cities = CITIES_BY_COUNTRY[country] || [];

  const fetchPrayerTimes = async () => {
    const selectedCity = customCity || city;
    const selectedCountry = COUNTRIES.find(c => c.code === country)?.name || country;
    
    if (!selectedCity) {
      toast({
        title: "City required",
        description: "Please select or enter a city",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(selectedCity)}&country=${encodeURIComponent(selectedCountry)}&method=4`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch prayer times");
      }
      
      const data = await response.json();
      
      if (data.code === 200 && data.data?.timings) {
        const timings = data.data.timings;
        
        const prayerTimes: PrayerTimeData[] = [
          { name: "Fajr", arabicName: "الفجر", time: timings.Fajr?.substring(0, 5) || "05:00" },
          { name: "Sunrise", arabicName: "الشروق", time: timings.Sunrise?.substring(0, 5) || "06:30" },
          { name: "Dhuhr", arabicName: "الظهر", time: timings.Dhuhr?.substring(0, 5) || "12:30" },
          { name: "Asr", arabicName: "العصر", time: timings.Asr?.substring(0, 5) || "15:45" },
          { name: "Maghrib", arabicName: "المغرب", time: timings.Maghrib?.substring(0, 5) || "18:15" },
          { name: "Isha", arabicName: "العشاء", time: timings.Isha?.substring(0, 5) || "19:45" },
        ];
        
        onTimesUpdate(prayerTimes);
        setLastFetched(new Date());
        
        // Save to localStorage
        localStorage.setItem('prayerCountry', country);
        localStorage.setItem('prayerCity', selectedCity);
        
        if (onLocationChange) {
          onLocationChange({ country: selectedCountry, city: selectedCity });
        }
        
        toast({
          title: "Prayer times updated",
          description: `Showing times for ${selectedCity}, ${selectedCountry}`,
        });
      } else {
        throw new Error("Invalid response from API");
      }
    } catch (error) {
      console.error("Failed to fetch prayer times:", error);
      toast({
        title: "Failed to fetch times",
        description: "Using default times. Check your city name.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount if we have saved location
  useEffect(() => {
    const savedCountry = localStorage.getItem('prayerCountry');
    const savedCity = localStorage.getItem('prayerCity');
    if (savedCountry && savedCity) {
      fetchPrayerTimes();
    }
  }, []);

  // Update city when country changes
  useEffect(() => {
    const newCities = CITIES_BY_COUNTRY[country];
    if (newCities && newCities.length > 0 && !newCities.includes(city)) {
      setCity(newCities[0]);
      setCustomCity("");
    }
  }, [country]);

  return (
    <div className="space-y-4 p-4 rounded-lg bg-secondary/30 border border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-foreground">Location Settings</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Country</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="bg-background/50">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">City</Label>
          {cities.length > 0 ? (
            <Select value={city} onValueChange={(val) => { setCity(val); setCustomCity(""); }}>
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value)}
              placeholder="Enter city name"
              className="bg-background/50"
            />
          )}
        </div>
      </div>
      
      {/* Custom city input for listed countries */}
      {cities.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Or enter custom city</Label>
          <Input
            value={customCity}
            onChange={(e) => setCustomCity(e.target.value)}
            placeholder="Enter another city..."
            className="bg-background/50"
          />
        </div>
      )}
      
      <Button 
        onClick={fetchPrayerTimes} 
        className="w-full gap-2"
        disabled={isLoading}
      >
        {isLoading ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {isLoading ? "Fetching..." : "Update Prayer Times"}
      </Button>
      
      {lastFetched && (
        <p className="text-xs text-center text-muted-foreground">
          Last updated: {lastFetched.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
};
