import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Moon } from "lucide-react";
import { PrayerTime } from "@/hooks/usePrayerTimes";

interface PrayerTimesCardProps {
  prayerTimes: PrayerTime[];
  nextPrayer: PrayerTime | null;
  timeUntilNext: string;
}

export const PrayerTimesCard = ({ prayerTimes, nextPrayer, timeUntilNext }: PrayerTimesCardProps) => {
  return (
    <Card className="glass-panel overflow-hidden">
      <div className="absolute inset-0 pattern-islamic pointer-events-none" />
      <CardHeader className="relative pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5 text-accent" />
            Prayer Times
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="relative">
        {nextPrayer && (
          <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary/20 glow-primary">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Next Prayer</p>
                <p className="text-2xl font-semibold text-primary">{nextPrayer.name}</p>
                <p className="font-arabic text-lg text-accent">{nextPrayer.arabicName}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-foreground">{nextPrayer.time}</p>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{timeUntilNext}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {prayerTimes.map((prayer) => (
            <div
              key={prayer.name}
              className={`p-3 rounded-lg transition-all duration-200 ${
                prayer.isNext
                  ? "bg-primary/20 border border-primary/30"
                  : "bg-secondary/30 hover:bg-secondary/50"
              }`}
            >
              <p className="text-xs text-muted-foreground">{prayer.name}</p>
              <p className="font-arabic text-sm text-accent/80">{prayer.arabicName}</p>
              <p className={`text-lg font-semibold ${prayer.isNext ? "text-primary" : "text-foreground"}`}>
                {prayer.time}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
