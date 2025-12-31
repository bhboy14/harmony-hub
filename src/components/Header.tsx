import { Clock, Moon } from "lucide-react";
import { PrayerTime } from "@/hooks/usePrayerTimes";

interface HeaderProps {
  prayerTimes: PrayerTime[];
  nextPrayer: PrayerTime | null;
  timeUntilNext: string;
}

export const Header = ({ prayerTimes, nextPrayer, timeUntilNext }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Next Prayer Highlight */}
        {nextPrayer && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <Moon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">{nextPrayer.name}</span>
              <span className="font-arabic text-sm text-accent">{nextPrayer.arabicName}</span>
              <span className="text-sm font-bold text-foreground">{nextPrayer.time}</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground border-l border-border/50 pl-2 ml-1">
                <Clock className="h-3 w-3" />
                <span>{timeUntilNext}</span>
              </div>
            </div>
          </div>
        )}

        {/* All Prayer Times Row */}
        <div className="flex items-center gap-1">
          {prayerTimes.map((prayer) => (
            <div
              key={prayer.name}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
                prayer.isNext
                  ? "bg-primary/20 border border-primary/30 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              <span>{prayer.name}</span>
              <span className={prayer.isNext ? "text-primary" : "text-foreground/70"}>{prayer.time}</span>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
};
