import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Cast, 
  Airplay, 
  Lock, 
  Unlock, 
  Radio, 
  Volume2, 
  Link2, 
  Unlink, 
  Plus, 
  Trash2, 
  Wifi,
  Clock,
  Users
} from "lucide-react";
import { useCasting, CastDevice } from "@/contexts/CastingContext";
import { useState } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const CastingSettings = () => {
  const {
    airplaySettings,
    multiRoom,
    isCastingSupported,
    isAirPlaySupported,
    isChromecastSupported,
    updateAirPlaySettings,
    addDeviceToMultiRoom,
    removeDeviceFromMultiRoom,
    createStereoPair,
    removeStereoPair,
    setDeviceVolume,
    startPairing,
    submitPairingPin,
    cancelPairing,
    pairingInProgress,
  } = useCasting();

  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showStereoPair, setShowStereoPair] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [selectedLeftDevice, setSelectedLeftDevice] = useState<string>('');
  const [selectedRightDevice, setSelectedRightDevice] = useState<string>('');
  const [stereoPairName, setStereoPairName] = useState('');
  const [pairingPin, setPairingPin] = useState('');

  const handleAddDevice = () => {
    if (!newDeviceName.trim()) return;
    
    const device: CastDevice = {
      id: `device-${Date.now()}`,
      name: newDeviceName.trim(),
      protocol: 'airplay',
      isPaired: false,
    };
    
    addDeviceToMultiRoom(device);
    setNewDeviceName('');
    setShowAddDevice(false);
    
    // Start pairing process
    startPairing(device);
  };

  const handleCreateStereoPair = () => {
    if (!selectedLeftDevice || !selectedRightDevice || !stereoPairName.trim()) return;
    createStereoPair(selectedLeftDevice, selectedRightDevice, stereoPairName.trim());
    setShowStereoPair(false);
    setSelectedLeftDevice('');
    setSelectedRightDevice('');
    setStereoPairName('');
  };

  const handleSubmitPin = async () => {
    if (pairingPin.length === 4) {
      await submitPairingPin(pairingPin);
      setPairingPin('');
    }
  };

  const unpairedDevices = multiRoom.devices.filter(d => !d.stereoRole);

  return (
    <div className="space-y-6">
      {/* Protocol Support Status */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cast className="h-5 w-5 text-accent" />
            Casting Protocols
          </CardTitle>
          <CardDescription>
            Available casting methods for this browser
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-3">
              <Airplay className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">AirPlay / RAOP</p>
                <p className="text-xs text-muted-foreground">Apple devices & compatible speakers</p>
              </div>
            </div>
            <Badge variant={isAirPlaySupported ? "default" : "secondary"}>
              {isAirPlaySupported ? "Available" : "Safari Only"}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-3">
              <Cast className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Google Cast</p>
                <p className="text-xs text-muted-foreground">Chromecast & Cast-enabled devices</p>
              </div>
            </div>
            <Badge variant={isChromecastSupported ? "default" : "secondary"}>
              {isChromecastSupported ? "Available" : "Chrome Only"}
            </Badge>
          </div>

          {!isCastingSupported && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Use Chrome for Chromecast or Safari for AirPlay
            </p>
          )}
        </CardContent>
      </Card>

      {/* AirPlay Settings */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Airplay className="h-5 w-5 text-accent" />
            AirPlay Settings
          </CardTitle>
          <CardDescription>
            Configure RAOP streaming options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Encryption Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {airplaySettings.encryption ? (
                <Lock className="h-4 w-4 text-primary" />
              ) : (
                <Unlock className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <Label className="text-foreground">Encryption</Label>
                <p className="text-xs text-muted-foreground">Encrypt AirPlay 1 audio streams</p>
              </div>
            </div>
            <Switch
              checked={airplaySettings.encryption}
              onCheckedChange={(checked) => updateAirPlaySettings({ encryption: checked })}
            />
          </div>

          {/* ALAC Compression */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Radio className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-foreground">ALAC Compression</Label>
                <p className="text-xs text-muted-foreground">Lossless compression (16-bit/44.1kHz)</p>
              </div>
            </div>
            <Switch
              checked={airplaySettings.alacCompression}
              onCheckedChange={(checked) => updateAirPlaySettings({ alacCompression: checked })}
            />
          </div>

          <Separator />

          {/* Jitter Buffer */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-foreground">Audio Buffer</Label>
                  <p className="text-xs text-muted-foreground">Prevents dropouts on unstable Wi-Fi</p>
                </div>
              </div>
              <span className="text-sm font-medium">{airplaySettings.jitterBufferMs}ms</span>
            </div>
            <Slider
              value={[airplaySettings.jitterBufferMs]}
              min={200}
              max={2000}
              step={100}
              onValueChange={([value]) => updateAirPlaySettings({ jitterBufferMs: value })}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Low latency</span>
              <span>Stable</span>
            </div>
          </div>

          <Separator />

          {/* Late Joining */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-foreground">Enable Late Joining</Label>
                <p className="text-xs text-muted-foreground">Allow speakers to join active streams</p>
              </div>
            </div>
            <Switch
              checked={airplaySettings.enableLateJoining}
              onCheckedChange={(checked) => updateAirPlaySettings({ enableLateJoining: checked })}
            />
          </div>

          {/* Ignore Device Volume */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-foreground">Ignore Device Volume Reports</Label>
                <p className="text-xs text-muted-foreground">Prevents volume slider conflicts</p>
              </div>
            </div>
            <Switch
              checked={airplaySettings.ignoreDeviceVolume}
              onCheckedChange={(checked) => updateAirPlaySettings({ ignoreDeviceVolume: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Multi-Room Management */}
      <Card className="glass-panel">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-accent" />
                Multi-Room Audio
              </CardTitle>
              <CardDescription>
                Manage synchronized speakers across rooms
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => setShowAddDevice(true)}
            >
              <Plus className="h-4 w-4" />
              Add Speaker
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {multiRoom.devices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wifi className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No speakers configured</p>
              <p className="text-xs">Add AirPlay speakers to create a multi-room setup</p>
            </div>
          ) : (
            <>
              {/* Stereo Pairs */}
              {multiRoom.stereoPairs.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Stereo Pairs
                  </h4>
                  {multiRoom.stereoPairs.map((pair, index) => {
                    const leftDevice = multiRoom.devices.find(d => d.id === pair.left);
                    const rightDevice = multiRoom.devices.find(d => d.id === pair.right);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                        <div className="flex items-center gap-3">
                          <Link2 className="h-4 w-4 text-primary" />
                          <div>
                            <p className="font-medium">{pair.name}</p>
                            <p className="text-xs text-muted-foreground">
                              L: {leftDevice?.name} • R: {rightDevice?.name}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStereoPair(index)}
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Individual Devices */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Speakers</h4>
                  {unpairedDevices.length >= 2 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-2 text-xs"
                      onClick={() => setShowStereoPair(true)}
                    >
                      <Link2 className="h-3 w-3" />
                      Create Stereo Pair
                    </Button>
                  )}
                </div>
                {multiRoom.devices.map((device) => (
                  <div key={device.id} className="p-3 rounded-lg bg-secondary/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Airplay className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{device.name}</p>
                          <div className="flex items-center gap-2">
                            {device.stereoRole && (
                              <Badge variant="outline" className="text-xs">
                                {device.stereoRole === 'left' ? 'Left' : 'Right'}
                              </Badge>
                            )}
                            <Badge 
                              variant={device.isPaired ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {device.isPaired ? "Paired" : "Not Paired"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDeviceFromMultiRoom(device.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                      <Slider
                        value={[device.volume || 100]}
                        max={100}
                        step={1}
                        onValueChange={([value]) => setDeviceVolume(device.id, value)}
                        className="flex-1"
                      />
                      <span className="text-xs w-8 text-right">{device.volume || 100}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {multiRoom.enabled && (
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Timestamped PCM streaming enabled for sync
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Device Dialog */}
      <Dialog open={showAddDevice} onOpenChange={setShowAddDevice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add AirPlay Speaker</DialogTitle>
            <DialogDescription>
              Enter the name of your AirPlay speaker to add it to the multi-room group
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Speaker Name</Label>
              <Input
                placeholder="e.g., Living Room HomePod"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDevice(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDevice} disabled={!newDeviceName.trim()}>
              Add & Pair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stereo Pair Dialog */}
      <Dialog open={showStereoPair} onOpenChange={setShowStereoPair}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Stereo Pair</DialogTitle>
            <DialogDescription>
              Combine two speakers for stereo audio output
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pair Name</Label>
              <Input
                placeholder="e.g., Living Room Stereo"
                value={stereoPairName}
                onChange={(e) => setStereoPairName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Left Speaker</Label>
                <Select value={selectedLeftDevice} onValueChange={setSelectedLeftDevice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unpairedDevices
                      .filter(d => d.id !== selectedRightDevice)
                      .map(device => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Right Speaker</Label>
                <Select value={selectedRightDevice} onValueChange={setSelectedRightDevice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unpairedDevices
                      .filter(d => d.id !== selectedLeftDevice)
                      .map(device => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStereoPair(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateStereoPair}
              disabled={!selectedLeftDevice || !selectedRightDevice || !stereoPairName.trim()}
            >
              Create Pair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pairing Dialog */}
      <Dialog open={pairingInProgress} onOpenChange={(open) => !open && cancelPairing()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Pairing Code</DialogTitle>
            <DialogDescription>
              Enter the 4-digit PIN shown on your AirPlay device
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-6">
            <InputOTP
              maxLength={4}
              value={pairingPin}
              onChange={setPairingPin}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelPairing}>
              Cancel
            </Button>
            <Button onClick={handleSubmitPin} disabled={pairingPin.length !== 4}>
              Pair Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
