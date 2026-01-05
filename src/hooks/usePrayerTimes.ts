import { useState, useEffect, useCallback } from "react";

export interface PrayerTime {
  name: string;
  arabicName: string;
  time: string;
  isNext: boolean;
}

export interface LocationSettings {
  country: string;
  city: string;
}

export const usePrayerTimes = () => {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([
    { name: "Fajr", arabicName: "الفجر", time: "05:15", isNext: false },
    { name: "Sunrise", arabicName: "الشروق", time: "06:45", isNext: false },
    { name: "Dhuhr", arabicName: "الظهر", time: "12:30", isNext: false },
    { name: "Asr", arabicName: "العصر", time: "15:45", isNext: false },
    { name: "Maghrib", arabicName: "المغرب", time: "18:15", isNext: false },
    { name: "Isha", arabicName: "العشاء", time: "19:45", isNext: false },
  ]);

  const [nextPrayer, setNextPrayer] = useState<PrayerTime | null>(null);
  const [timeUntilNext, setTimeUntilNext] = useState<string>("");
  const [location, setLocation] = useState<LocationSettings>({
    country: localStorage.getItem('prayerCountry') || "Saudi Arabia",
    city: localStorage.getItem('prayerCity') || "Mecca",
  });

  // Update prayer times from external data
  const updatePrayerTimes = useCallback((times: { name: string; arabicName: string; time: string }[]) => {
    setPrayerTimes(times.map(t => ({ ...t, isNext: false })));
  }, []);

  // Update location
  const updateLocation = useCallback((newLocation: LocationSettings) => {
    setLocation(newLocation);
    localStorage.setItem('prayerCountry', newLocation.country);
    localStorage.setItem('prayerCity', newLocation.city);
  }, []);

  useEffect(() => {
    const updateNextPrayer = () => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const updatedTimes = prayerTimes.map((prayer) => {
        const [hours, minutes] = prayer.time.split(":").map(Number);
        const prayerMinutes = hours * 60 + minutes;
        return { ...prayer, prayerMinutes };
      });

      let nextIndex = updatedTimes.findIndex((p) => p.prayerMinutes > currentMinutes);
      if (nextIndex === -1) nextIndex = 0;

      const updated = prayerTimes.map((p, i) => ({ ...p, isNext: i === nextIndex }));
      setPrayerTimes(updated);
      setNextPrayer(updated[nextIndex]);

      // Calculate time until next prayer
      const [nextHours, nextMinutes] = updated[nextIndex].time.split(":").map(Number);
      let nextPrayerMinutes = nextHours * 60 + nextMinutes;
      if (nextPrayerMinutes <= currentMinutes) {
        nextPrayerMinutes += 24 * 60;
      }
      const diff = nextPrayerMinutes - currentMinutes;
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      setTimeUntilNext(`${hours}h ${mins}m`);
    };

    updateNextPrayer();
    const interval = setInterval(updateNextPrayer, 60000);
    return () => clearInterval(interval);
  }, [prayerTimes]);

  return { 
    prayerTimes, 
    nextPrayer, 
    timeUntilNext, 
    setPrayerTimes,
    updatePrayerTimes,
    location,
    updateLocation,
  };
};
