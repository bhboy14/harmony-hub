import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  Megaphone, 
  Mic, 
  MicOff, 
  Volume2, 
  Radio, 
  Settings2,
  Music,
  Waves
} from "lucide-react";
import { useUnifiedAudio, AudioSource } from "@/contexts/UnifiedAudioContext";
import { useToast } from "@/hooks/use-toast";

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: string;
}

export const PASystem = () => {
  const [isLive, setIsLive] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [micVolume, setMicVolume] = useState(80);
  const [musicDuckLevel, setMusicDuckLevel] = useState(20);
  const [fadeInDuration, setFadeInDuration] = useState(2);
  const [fadeOutDuration, setFadeOutDuration] = useState(2);
  const [echoAmount, setEchoAmount] = useState(0);
  const [delayAmount, setDelayAmount] = useState(0);
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [selectedOutput, setSelectedOutput] = useState<string>("");
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [autoDuck, setAutoDuck] = useState(true);
  
  const unifiedAudio = useUnifiedAudio();
  const { toast } = useToast();
  
  // Audio context refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const feedbackNodeRef = useRef<GainNode | null>(null);
  const preBroadcastStateRef = useRef<{ previousVolume: number; wasPlaying: boolean; activeSource: AudioSource } | null>(null);

  const [presets] = useState([
    { id: "1", name: "Meeting Starting", text: "Attention everyone. The meeting will begin in 5 minutes in the main conference room." },
    { id: "2", name: "Lunch Break", text: "Attention please. It is now time for lunch break. Normal operations will resume in one hour." },
    { id: "3", name: "Fire Drill", text: "This is a fire drill. Please evacuate the building calmly using the nearest exit." },
    { id: "4", name: "Closing Time", text: "Attention please. The facility will be closing in 15 minutes. Please prepare to leave." },
  ]);

  const zones = [
    { id: "all", name: "All Zones" },
    { id: "main", name: "Main Area" },
    { id: "office", name: "Office Section" },
    { id: "lounge", name: "Lounge Area" },
    { id: "outdoor", name: "Outdoor Area" },
  ];

  // Enumerate audio devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request mic permission first to get device labels
        await navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          stream.getTracks().forEach(track => track.stop());
        });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices
          .filter(d => d.kind === 'audioinput')
          .map(d => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${d.deviceId.slice(0, 4)}`,
            kind: d.kind
          }));
        
        const audioOutputs = devices
          .filter(d => d.kind === 'audiooutput')
          .map(d => ({
            deviceId: d.deviceId,
            label: d.label || `Speaker ${d.deviceId.slice(0, 4)}`,
            kind: d.kind
          }));
        
        setAudioDevices([...audioInputs, ...audioOutputs]);
        
        if (audioInputs.length > 0 && !selectedMic) {
          setSelectedMic(audioInputs[0].deviceId);
        }
        if (audioOutputs.length > 0 && !selectedOutput) {
          setSelectedOutput(audioOutputs[0].deviceId);
        }
      } catch (err) {
        console.error("Error enumerating devices:", err);
        toast({
          title: "Microphone access required",
          description: "Please allow microphone access for Broadcast Mode",
          variant: "destructive"
        });
      }
    };
    
    getDevices();
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    };
  }, [toast, selectedMic, selectedOutput]);

  const startBroadcast = useCallback(async () => {
    try {
      // Create audio context
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedMic ? { exact: selectedMic } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      mediaStreamRef.current = stream;
      
      // Create audio graph
      const source = audioContext.createMediaStreamSource(stream);
      
      // Gain node for mic volume
      const gainNode = audioContext.createGain();
      gainNode.gain.value = micVolume / 100;
      gainNodeRef.current = gainNode;
      
      // Delay node for echo/delay effect
      const delayNode = audioContext.createDelay(1.0);
      delayNode.delayTime.value = delayAmount / 100 * 0.5; // 0-0.5 seconds
      delayNodeRef.current = delayNode;
      
      // Feedback gain for echo
      const feedbackNode = audioContext.createGain();
      feedbackNode.gain.value = echoAmount / 100 * 0.6; // 0-0.6 feedback
      feedbackNodeRef.current = feedbackNode;
      
      // Connect audio graph
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // If echo/delay is enabled, create feedback loop
      if (echoAmount > 0 || delayAmount > 0) {
        gainNode.connect(delayNode);
        delayNode.connect(feedbackNode);
        feedbackNode.connect(delayNode);
        delayNode.connect(audioContext.destination);
      }
      
      // Duck ALL music sources if auto-duck is enabled
      if (autoDuck && (unifiedAudio.isPlaying || unifiedAudio.activeSource)) {
        try {
          const state = await unifiedAudio.fadeAllAndPause(musicDuckLevel, fadeOutDuration * 1000);
          preBroadcastStateRef.current = state;
        } catch (err) {
          console.warn('Could not duck audio:', err);
        }
      }
      
      setIsLive(true);
      toast({
        title: "Broadcast Started",
        description: "You are now live. All music has been paused.",
      });
    } catch (err) {
      console.error("Error starting broadcast:", err);
      toast({
        title: "Broadcast Failed",
        description: "Could not start broadcast. Check microphone permissions.",
        variant: "destructive"
      });
    }
  }, [selectedMic, micVolume, delayAmount, echoAmount, autoDuck, unifiedAudio, musicDuckLevel, fadeOutDuration, toast]);

  const stopBroadcast = useCallback(async () => {
    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Restore ALL music sources
    if (autoDuck && preBroadcastStateRef.current) {
      try {
        await unifiedAudio.resumeAll(preBroadcastStateRef.current, fadeInDuration * 1000);
        preBroadcastStateRef.current = null;
      } catch (err) {
        console.warn('Could not restore audio:', err);
      }
    }
    
    setIsLive(false);
    toast({
      title: "Broadcast Ended",
      description: "Music playback has been resumed.",
    });
  }, [autoDuck, unifiedAudio, fadeInDuration, toast]);

  // Update audio nodes when settings change during broadcast
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = micVolume / 100;
    }
    if (delayNodeRef.current) {
      delayNodeRef.current.delayTime.value = delayAmount / 100 * 0.5;
    }
    if (feedbackNodeRef.current) {
      feedbackNodeRef.current.gain.value = echoAmount / 100 * 0.6;
    }
  }, [micVolume, delayAmount, echoAmount]);

  const micDevices = audioDevices.filter(d => d.kind === 'audioinput');
  const outputDevices = audioDevices.filter(d => d.kind === 'audiooutput');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Main Broadcast Panel */}
      <Card className="glass-panel">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-accent" />
              Broadcast Mode
            </CardTitle>
            {isLive && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/20 border border-destructive/30">
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-xs font-medium text-destructive">LIVE</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Device Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Microphone
              </Label>
              <Select value={selectedMic} onValueChange={setSelectedMic} disabled={isLive}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent>
                  {micDevices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Output Speaker
              </Label>
              <Select value={selectedOutput} onValueChange={setSelectedOutput} disabled={isLive}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Select speaker" />
                </SelectTrigger>
                <SelectContent>
                  {outputDevices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Volume Controls */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Mic Volume
                </Label>
                <span className="text-sm font-medium text-foreground">{micVolume}%</span>
              </div>
              <Slider
                value={[micVolume]}
                max={100}
                step={1}
                onValueChange={([v]) => setMicVolume(v)}
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Quick Announcements</Label>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.id}
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-2 justify-start"
                  onClick={() => setAnnouncement(preset.text)}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Announcement Text */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Announcement Text (for reference)</Label>
            <Textarea
              placeholder="Type your announcement here to read from..."
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              className="min-h-[80px] bg-secondary/50 border-border/50 resize-none"
            />
          </div>

          {/* Live Mic Button */}
          <Button
            variant={isLive ? "destructive" : "glow"}
            className="w-full h-16 text-lg"
            onClick={() => isLive ? stopBroadcast() : startBroadcast()}
          >
            {isLive ? (
              <>
                <MicOff className="h-6 w-6 mr-2" />
                Stop Broadcast
              </>
            ) : (
              <>
                <Mic className="h-6 w-6 mr-2" />
                Go Live
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Audio Effects & Settings Panel */}
      <Card className="glass-panel">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-accent" />
            Audio Mixer & Effects
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-Duck Toggle */}
          <div className="p-4 rounded-lg bg-secondary/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-accent" />
                <Label className="text-sm font-medium">Auto-Duck Music</Label>
              </div>
              <Switch checked={autoDuck} onCheckedChange={setAutoDuck} />
            </div>
            <p className="text-xs text-muted-foreground">
              Automatically lower music volume when broadcasting
            </p>
            
            {autoDuck && (
              <div className="space-y-4 pt-2 border-t border-border/50">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Music Level During Broadcast</Label>
                    <span className="text-sm font-medium">{musicDuckLevel}%</span>
                  </div>
                  <Slider
                    value={[musicDuckLevel]}
                    max={50}
                    step={5}
                    onValueChange={([v]) => setMusicDuckLevel(v)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Fade Out (s)</Label>
                    <Slider
                      value={[fadeOutDuration]}
                      max={5}
                      step={0.5}
                      onValueChange={([v]) => setFadeOutDuration(v)}
                    />
                    <span className="text-xs text-muted-foreground">{fadeOutDuration}s</span>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Fade In (s)</Label>
                    <Slider
                      value={[fadeInDuration]}
                      max={5}
                      step={0.5}
                      onValueChange={([v]) => setFadeInDuration(v)}
                    />
                    <span className="text-xs text-muted-foreground">{fadeInDuration}s</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Audio Effects */}
          <div className="p-4 rounded-lg bg-secondary/30 space-y-4">
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-accent" />
              <Label className="text-sm font-medium">Audio Effects</Label>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Echo</Label>
                  <span className="text-sm font-medium">{echoAmount}%</span>
                </div>
                <Slider
                  value={[echoAmount]}
                  max={100}
                  step={5}
                  onValueChange={([v]) => setEchoAmount(v)}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Delay</Label>
                  <span className="text-sm font-medium">{delayAmount}%</span>
                </div>
                <Slider
                  value={[delayAmount]}
                  max={100}
                  step={5}
                  onValueChange={([v]) => setDelayAmount(v)}
                />
              </div>
            </div>
          </div>

          {/* Zone Selection */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Radio className="h-4 w-4" />
              Broadcast Zone
            </Label>
            <Select defaultValue="all">
              <SelectTrigger className="bg-secondary/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Live Status */}
          {isLive && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                  <Mic className="h-5 w-5 text-destructive animate-pulse" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Broadcasting Live</p>
                  <p className="text-sm text-muted-foreground">Speak into your microphone</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};