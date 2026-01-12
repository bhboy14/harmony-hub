import { useState, useCallback } from "react";
import { Upload, Music, X, Loader2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUnifiedLibrary, UnifiedTrack } from "@/hooks/useUnifiedLibrary";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface LocalUploaderProps {
  onTrackUploaded?: (track: UnifiedTrack) => void;
}

export const LocalUploader = ({ onTrackUploaded }: LocalUploaderProps) => {
  const { uploadLocalFile, uploadProgress } = useUnifiedLibrary();
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('audio/')
    );
    
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(
      file => file.type.startsWith('audio/')
    );
    setFiles(prev => [...prev, ...selectedFiles]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const uploadFiles = useCallback(async () => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    
    for (const file of files) {
      const track = await uploadLocalFile(file);
      if (track && onTrackUploaded) {
        onTrackUploaded(track);
      }
    }
    
    setFiles([]);
    setIsUploading(false);
    setIsOpen(false);
  }, [files, uploadLocalFile, onTrackUploaded]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-1" /> Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Audio Files</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          {/* Drop Zone */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              isDragging 
                ? 'border-primary bg-primary/10' 
                : 'border-border hover:border-muted-foreground'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="audio/*"
              multiple
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileSelect}
            />
            
            <div className="flex flex-col items-center gap-3">
              <div className={`p-4 rounded-full ${isDragging ? 'bg-primary/20' : 'bg-secondary'}`}>
                <Upload className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {isDragging ? 'Drop files here' : 'Drag & drop audio files'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to browse • MP3, WAV, M4A, FLAC
                </p>
              </div>
            </div>
          </div>

          {/* File Queue */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {files.length} file{files.length > 1 ? 's' : ''} ready to upload
              </p>
              
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {files.map((file, index) => (
                  <div 
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-3 p-3 bg-secondary rounded-lg"
                  >
                    <div className="p-2 bg-background rounded">
                      <Music className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFile(index)}
                      disabled={isUploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Upload Progress */}
              {isUploading && uploadProgress !== null && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              {/* Upload Button */}
              <Button
                className="w-full"
                onClick={uploadFiles}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {files.length} file{files.length > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
