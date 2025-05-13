
import React, { useState, useCallback, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlistService, FileInfo } from "@/services/alistService";
import { Upload, FolderOpen, ChevronLeft, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ImageUploaderProps {
  alistService: AlistService | null;
  currentPath: string;
  onUploadSuccess: () => void;
  onPathChange: (path: string) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  alistService,
  currentPath,
  onUploadSuccess,
  onPathChange
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [directories, setDirectories] = useState<FileInfo[]>([]);
  const [isLoadingDirs, setIsLoadingDirs] = useState(false);

  // Load directories in the current path
  const loadDirectories = useCallback(async () => {
    if (!alistService) return;
    
    setIsLoadingDirs(true);
    try {
      const filesList = await alistService.listFiles(currentPath);
      // Filter to only show directories
      const dirs = filesList.filter(file => file.is_dir);
      setDirectories(dirs);
    } catch (error: any) {
      toast.error(`Error loading directories: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoadingDirs(false);
    }
  }, [alistService, currentPath]);

  useEffect(() => {
    loadDirectories();
  }, [loadDirectories]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    setFiles(selectedFiles);
    
    if (selectedFiles && selectedFiles.length > 0) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(selectedFiles[0]);
    } else {
      setImagePreviewUrl(null);
    }
  };

  const handleUpload = useCallback(async () => {
    if (!alistService || !files || files.length === 0) {
      toast.error("Please select a file to upload");
      return;
    }

    setIsUploading(true);
    setUploadedImageUrl(null);

    try {
      const file = files[0];
      
      // Check if the file is an image
      if (!file.type.startsWith('image/')) {
        toast.error("Only image files are allowed");
        setIsUploading(false);
        return;
      }

      await alistService.uploadFile(currentPath, file);
      
      // Get the file link
      const fileLink = await alistService.getFileLink(`${currentPath}${currentPath.endsWith('/') ? '' : '/'}${file.name}`);
      setUploadedImageUrl(fileLink);
      
      onUploadSuccess();
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  }, [alistService, files, currentPath, onUploadSuccess]);

  const copyToClipboard = useCallback(() => {
    if (uploadedImageUrl) {
      navigator.clipboard.writeText(uploadedImageUrl);
      toast.success("Image URL copied to clipboard");
    }
  }, [uploadedImageUrl]);

  const handlePathChange = (path: string) => {
    onPathChange(path);
  };

  const navigateToFolder = (folderName: string) => {
    const newPath = `${currentPath}${currentPath.endsWith('/') ? '' : '/'}${folderName}`;
    onPathChange(newPath);
  };

  const navigateUp = () => {
    if (currentPath === "/") return;
    
    const newPath = currentPath.split("/").slice(0, -1).join("/") || "/";
    onPathChange(newPath);
  };

  const handleCreateFolder = async () => {
    if (!alistService) return;
    
    const folderName = prompt("Enter new folder name:");
    if (!folderName) return;
    
    try {
      await alistService.createFolder(currentPath, folderName);
      toast.success(`Folder "${folderName}" created successfully`);
      loadDirectories();
    } catch (error: any) {
      toast.error(`Failed to create folder: ${error.message || 'Unknown error'}`);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Images</CardTitle>
        <CardDescription>Upload your images to AList</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Path navigation */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={navigateUp}
                disabled={currentPath === "/"}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Up
              </Button>
              <span className="text-sm font-medium">Current path: {currentPath}</span>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-2">
              {isLoadingDirs ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : (
                <>
                  {directories.length === 0 ? (
                    <p className="text-sm text-gray-500">No subfolders in this directory</p>
                  ) : (
                    <Select onValueChange={navigateToFolder}>
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Select a folder" />
                      </SelectTrigger>
                      <SelectContent>
                        {directories.map((dir) => (
                          <SelectItem key={dir.name} value={dir.name}>
                            <div className="flex items-center">
                              <FolderOpen className="h-4 w-4 mr-2 text-yellow-500" />
                              {dir.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button variant="outline" size="sm" onClick={handleCreateFolder}>
                    Create Folder
                  </Button>
                  <Button variant="outline" size="sm" onClick={loadDirectories}>
                    Refresh
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="mb-4"
            />
            
            {imagePreviewUrl && (
              <div className="mt-4">
                <img
                  src={imagePreviewUrl}
                  alt="Preview"
                  className="max-h-64 max-w-full rounded-lg"
                />
              </div>
            )}
            
            <Button
              onClick={handleUpload}
              disabled={!files || isUploading}
              className="mt-4"
            >
              {isUploading ? (
                "Uploading..."
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload to {currentPath}
                </>
              )}
            </Button>
          </div>

          {uploadedImageUrl && (
            <div className="mt-6 space-y-4">
              <h3 className="font-medium">Uploaded Image URL</h3>
              <div className="flex items-center space-x-2">
                <Input
                  value={uploadedImageUrl}
                  readOnly
                  className="flex-1"
                />
                <Button onClick={copyToClipboard} variant="outline">
                  Copy
                </Button>
              </div>
              <div className="mt-2">
                <img
                  src={uploadedImageUrl}
                  alt="Uploaded"
                  className="max-h-64 max-w-full rounded-lg"
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ImageUploader;
