import { Clock, Moon } from "lucide-react";
import { PrayerTime } from "@/hooks/usePrayerTimes";

interface PrayerTimesCompactProps {
  prayerTimes: PrayerTime[];
  nextPrayer: PrayerTime | null;
  timeUntilNext: string;
}

export const PrayerTimesCompact = ({ prayerTimes, nextPrayer, timeUntilNext }: PrayerTimesCompactProps) => {
  return (
    <div className="glass-panel rounded-xl p-4 border border-border/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-accent" />
          <span className="font-medium text-foreground">Prayer Times</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>
      
      {/* Next Prayer Highlight */}
      {nextPrayer && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20 mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Next</p>
            <p className="font-semibold text-primary">{nextPrayer.name}</p>
            <p className="font-arabic text-sm text-accent">{nextPrayer.arabicName}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-foreground">{nextPrayer.time}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{timeUntilNext}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* All Prayer Times Row */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {prayerTimes.map((prayer) => (
          <div
            key={prayer.name}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-center transition-all ${
              prayer.isNext
                ? "bg-primary/20 border border-primary/30"
                : "bg-secondary/30"
            }`}
          >
            <p className="text-xs text-muted-foreground">{prayer.name}</p>
            <p className={`text-sm font-semibold ${prayer.isNext ? "text-primary" : "text-foreground"}`}>
              {prayer.time}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
