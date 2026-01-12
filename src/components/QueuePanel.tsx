import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ListMusic, 
  Play, 
  Pause, 
  X, 
  Music, 
  Trash2,
  GripVertical,
  Youtube,
  HardDrive,
  Cloud
} from "lucide-react";
import { QueueTrack } from "@/hooks/useUnifiedQueue";
import { AudioSource } from "@/contexts/UnifiedAudioContext";

interface QueuePanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  queue: QueueTrack[];
  currentIndex: number;
  upcomingTracks: QueueTrack[];
  history: QueueTrack[];
  onPlayTrack: (index: number) => void;
  onRemoveTrack: (queueId: string) => void;
  onClearQueue: () => void;
  onClearUpcoming: () => void;
  isPlaying: boolean;
}

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const SoundCloudIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
    <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.054-.049-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094l-.199 1.427.199 1.391c.013.058.044.094.104.094.059 0 .09-.037.104-.094l.223-1.391-.223-1.427c-.014-.057-.045-.094-.104-.094m1.79-.903c-.061 0-.104.045-.109.104l-.215 1.93.215 1.858c.005.059.048.104.109.104.059 0 .104-.045.108-.104l.24-1.858-.24-1.93c-.004-.059-.049-.104-.108-.104m.899-.127c-.07 0-.119.054-.121.118l-.189 2.057.189 1.97c.002.064.051.118.121.118.068 0 .12-.054.121-.118l.212-1.97-.212-2.057c-.001-.064-.053-.118-.121-.118m.9-.113c-.079 0-.133.063-.136.133l-.168 2.17.168 1.997c.003.07.057.132.136.132.078 0 .131-.062.135-.132l.189-1.997-.189-2.17c-.004-.07-.057-.133-.135-.133m.9-.088c-.088 0-.148.072-.149.149l-.147 2.258.147 2.013c.001.077.061.149.149.149.087 0 .148-.072.149-.149l.166-2.013-.166-2.258c-.001-.077-.062-.149-.149-.149m.9-.089c-.097 0-.163.081-.164.164l-.126 2.347.126 2.028c.001.083.067.164.164.164.097 0 .163-.081.164-.164l.142-2.028-.142-2.347c-.001-.083-.067-.164-.164-.164m.9-.08c-.107 0-.178.09-.179.179l-.105 2.427.105 2.043c.001.089.072.179.179.179s.178-.09.179-.179l.118-2.043-.118-2.427c-.001-.089-.072-.179-.179-.179m.903-.065c-.115 0-.193.098-.194.194l-.084 2.492.084 2.057c.001.096.079.194.194.194.114 0 .192-.098.193-.194l.095-2.057-.095-2.492c-.001-.096-.079-.194-.193-.194m.902-.049c-.124 0-.207.107-.208.208l-.063 2.541.063 2.072c.001.101.084.208.208.208.123 0 .207-.107.208-.208l.071-2.072-.071-2.541c-.001-.101-.085-.208-.208-.208m.903-.032c-.132 0-.22.116-.221.221l-.042 2.573.042 2.086c.001.105.089.221.221.221.131 0 .22-.116.221-.221l.047-2.086-.047-2.573c-.001-.105-.09-.221-.221-.221m.903-.016c-.141 0-.234.125-.235.235l-.021 2.589.021 2.101c.001.11.094.235.235.235.14 0 .234-.125.235-.235l.023-2.101-.023-2.589c-.001-.11-.095-.235-.235-.235m5.119.014c-.165 0-.297.134-.297.298v4.684c0 .165.132.298.297.298h.055c.165 0 .297-.133.297-.298V9.998c0-.164-.132-.298-.297-.298h-.055m-4.216.017c-.149 0-.249.133-.25.249v4.465c.001.116.101.249.25.249.148 0 .249-.133.25-.249V9.998c-.001-.116-.102-.249-.25-.249m.903.016c-.157 0-.263.141-.264.264v4.434c.001.123.107.264.264.264.156 0 .262-.141.263-.264v-4.434c-.001-.123-.107-.264-.263-.264m.903.016c-.165 0-.277.149-.278.278v4.402c.001.129.113.278.278.278.164 0 .276-.149.277-.278v-4.402c-.001-.129-.113-.278-.277-.278m.903.016c-.173 0-.291.157-.292.292v4.37c.001.135.119.292.292.292.172 0 .29-.157.291-.292v-4.37c-.001-.135-.119-.292-.291-.292"/>
  </svg>
);

const getSourceIcon = (source: AudioSource) => {
  switch (source) {
    case 'spotify': return <SpotifyIcon />;
    case 'local': return <HardDrive className="h-3 w-3" />;
    case 'youtube': return <Youtube className="h-3 w-3 text-red-500" />;
    case 'soundcloud': return <SoundCloudIcon />;
    default: return <Music className="h-3 w-3" />;
  }
};

const formatDuration = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const TrackItem = ({
  track,
  index,
  isCurrent,
  isPlaying,
  onPlay,
  onRemove,
}: {
  track: QueueTrack;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onRemove: () => void;
}) => (
  <div 
    className={`flex items-center gap-3 p-2 rounded-lg group transition-colors ${
      isCurrent ? 'bg-primary/20' : 'hover:bg-accent/50'
    }`}
  >
    <div className="w-4 text-center shrink-0">
      {isCurrent && isPlaying ? (
        <div className="flex items-end justify-center gap-0.5 h-4">
          <div className="w-0.5 h-2 bg-primary animate-pulse" />
          <div className="w-0.5 h-3 bg-primary animate-pulse delay-75" />
          <div className="w-0.5 h-2 bg-primary animate-pulse delay-150" />
        </div>
      ) : (
        <span className="text-xs text-muted-foreground group-hover:hidden">
          {index + 1}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-4 w-4 hidden group-hover:flex"
        onClick={onPlay}
      >
        {isCurrent && isPlaying ? (
          <Pause className="h-3 w-3" />
        ) : (
          <Play className="h-3 w-3" />
        )}
      </Button>
    </div>

    {track.albumArt ? (
      <img 
        src={track.albumArt} 
        alt="" 
        className="w-10 h-10 rounded object-cover shrink-0"
      />
    ) : (
      <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center shrink-0">
        <Music className="h-4 w-4 text-muted-foreground" />
      </div>
    )}

    <div className="flex-1 min-w-0">
      <p className={`text-sm truncate ${isCurrent ? 'text-primary font-medium' : 'text-foreground'}`}>
        {track.title}
      </p>
      <div className="flex items-center gap-1.5">
        {getSourceIcon(track.source)}
        <span className="text-xs text-muted-foreground truncate">
          {track.artist}
        </span>
      </div>
    </div>

    <span className="text-xs text-muted-foreground shrink-0">
      {formatDuration(track.duration)}
    </span>

    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
    >
      <X className="h-3 w-3" />
    </Button>
  </div>
);

export const QueuePanel = ({
  isOpen,
  onOpenChange,
  queue,
  currentIndex,
  upcomingTracks,
  history,
  onPlayTrack,
  onRemoveTrack,
  onClearQueue,
  onClearUpcoming,
  isPlaying,
}: QueuePanelProps) => {
  const currentTrack = queue[currentIndex];

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[450px] p-0 bg-background/95 backdrop-blur-xl">
        <SheetHeader className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <ListMusic className="h-5 w-5" />
              Queue
            </SheetTitle>
            {queue.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearQueue}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Music className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">Your queue is empty</p>
              <p className="text-xs mt-1">Add tracks from any source to get started</p>
            </div>
          ) : (
            <div className="p-4 space-y-6">
              {/* Now Playing */}
              {currentTrack && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Now Playing
                  </h3>
                  <TrackItem
                    track={currentTrack}
                    index={currentIndex}
                    isCurrent={true}
                    isPlaying={isPlaying}
                    onPlay={() => onPlayTrack(currentIndex)}
                    onRemove={() => onRemoveTrack(currentTrack.queueId)}
                  />
                </div>
              )}

              {/* Up Next */}
              {upcomingTracks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Up Next ({upcomingTracks.length})
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClearUpcoming}
                      className="text-xs text-muted-foreground hover:text-destructive h-6 px-2"
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {upcomingTracks.map((track, idx) => (
                      <TrackItem
                        key={track.queueId}
                        track={track}
                        index={currentIndex + 1 + idx}
                        isCurrent={false}
                        isPlaying={false}
                        onPlay={() => onPlayTrack(currentIndex + 1 + idx)}
                        onRemove={() => onRemoveTrack(track.queueId)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* History */}
              {history.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Recently Played
                  </h3>
                  <div className="space-y-1 opacity-60">
                    {history.slice(-5).reverse().map((track, idx) => (
                      <div 
                        key={`history-${track.queueId}-${idx}`}
                        className="flex items-center gap-3 p-2"
                      >
                        {track.albumArt ? (
                          <img 
                            src={track.albumArt} 
                            alt="" 
                            className="w-8 h-8 rounded object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center shrink-0">
                            <Music className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate text-muted-foreground">
                            {track.title}
                          </p>
                          <span className="text-xs text-muted-foreground/70 truncate">
                            {track.artist}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
