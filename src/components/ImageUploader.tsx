
import React, { useState, useCallback, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlistService, FileInfo } from "@/services/alistService";
import { Upload, FolderOpen, ChevronLeft, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface ImageUploaderProps {
  alistService: AlistService | null;
  currentPath: string;
  onUploadSuccess: () => void;
  onPathChange: (path: string) => void;
  directoryPasswords: Record<string, string>; // Add directoryPasswords prop
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  alistService,
  currentPath,
  onUploadSuccess,
  onPathChange,
  directoryPasswords // Destructure directoryPasswords prop
}) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [directories, setDirectories] = useState<FileInfo[]>([]);
  const [isLoadingDirs, setIsLoadingDirs] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Load directories in the current path
  const loadDirectories = useCallback(async () => {
    if (!alistService) {
      console.log("ImageUploader loadDirectories: alistService is null, returning.");
      setDirectories([]); // Clear directories if service is not available
      setIsLoadingDirs(false);
      return;
    }
    
    setIsLoadingDirs(true);
    setConnectionError(null);
    
    try {
      const passwordToUse = directoryPasswords[currentPath]; // Get password from props
      console.log(`ImageUploader loadDirectories: directoryPasswords props:`, directoryPasswords); // Log full passwords object
      console.log(`ImageUploader loadDirectories: Loading directories for path: ${currentPath}, using password: ${passwordToUse ? 'yes' : 'no'}`); // Log password usage
      const filesList = await alistService.listFiles(currentPath, passwordToUse); // Pass password
      // Filter to only show directories
      const dirs = filesList.filter(file => file.is_dir);
      setDirectories(dirs);
    } catch (error: any) {
      console.error("ImageUploader loadDirectories error:", error); // Log the full error
      setConnectionError(error.message || t('imageUploaderUnknownLoadingError')); // Use translation key
      toast.error(`${t('imageUploaderLoadingError')} ${error.message || t('imageUploaderUnknownLoadingError')}`); // Use translation key
      setDirectories([]); // Clear directories on error
    } finally {
      setIsLoadingDirs(false);
    }
  }, [alistService, currentPath, directoryPasswords, t]);

  // Effect to load directories when alistService, currentPath, or directoryPasswords changes
  useEffect(() => {
    console.log("ImageUploader useEffect: alistService, currentPath, or directoryPasswords changed", { alistService: !!alistService, currentPath, directoryPasswords: Object.keys(directoryPasswords).length }); // Log effect trigger
    if (alistService) {
      loadDirectories();
    } else {
      setDirectories([]); // Clear directories if service becomes null
    }
  }, [alistService, currentPath, directoryPasswords, loadDirectories]);

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
      toast.error(t('imageUploaderSelectFile')); // Use translation key
      return;
    }

    setIsUploading(true);
    setUploadedImageUrl(null);

    try {
      const file = files[0];
      
      // Check if the file is an image
      if (!file.type.startsWith('image/')) {
        toast.error(t('imageUploaderOnlyImagesAllowed')); // Use translation key
        setIsUploading(false);
        return;
      }

      await alistService.uploadFile(currentPath, file);
      
      // Get the file link
      const fileLink = await alistService.getFileLink(`${currentPath}${currentPath.endsWith('/') ? '' : '/'}${file.name}`);
      setUploadedImageUrl(fileLink);
      
      onUploadSuccess();
      loadDirectories(); // Refresh directory list
    } catch (error: any) {
      toast.error(`${t('imageUploaderCreateFolderFailed')} ${error.message || t('imageUploaderUnknownLoadingError')}`); // Use translation key
    } finally {
      setIsUploading(false);
    }
  }, [alistService, files, currentPath, onUploadSuccess, loadDirectories, t]); // Add t to dependency array

  const copyToClipboard = useCallback(() => {
    if (uploadedImageUrl) {
      navigator.clipboard.writeText(uploadedImageUrl);
      toast.success(t('imageUploaderCopy')); // Use translation key
    }
  }, [uploadedImageUrl, t]); // Add t to dependency array

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
    
    const folderName = prompt(t('imageUploaderEnterFolderName')); // Use translation key
    if (!folderName) return;
    
    try {
      await alistService.createFolder(currentPath, folderName);
      toast.success(t('imageUploaderCreateFolderSuccess', { folderName })); // Use translation key with interpolation
      loadDirectories();
    } catch (error: any) {
      toast.error(`${t('imageUploaderCreateFolderFailed')} ${error.message || t('imageUploaderUnknownLoadingError')}`); // Use translation key
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t('imageUploaderTitle')}</CardTitle> {/* Use translation key */}
        <CardDescription>{t('imageUploaderDescription')}</CardDescription> {/* Use translation key */}
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {connectionError && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded relative mb-4">
              <strong className="font-bold">{t('imageUploaderConnectionError')} </strong> {/* Use translation key */}
              <span className="block sm:inline">{connectionError}</span>
              <p className="mt-2 text-sm">
                {t('imageUploaderCheckSettings')} {/* Use translation key */}
              </p>
            </div>
          )}

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
                {t('imageUploaderUp')} {/* Use translation key */}
              </Button>
              <span className="text-sm font-medium">{t('imageUploaderCurrentPath')} {currentPath}</span> {/* Use translation key */}
            </div>
            
            <div className="flex flex-wrap gap-2 mt-2">
              {isLoadingDirs ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('imageUploaderLoadingDirs')}</span> {/* Use translation key */}
                </div>
              ) : (
                <>
                  {directories.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      {connectionError ? t('imageUploaderCouldNotLoadDirs') : t('imageUploaderNoSubfolders')} {/* Use translation key */}
                    </p>
                  ) : (
                    <Select onValueChange={navigateToFolder}>
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder={t('imageUploaderSelectFolder')} /> {/* Use translation key */}
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
                  <Button variant="outline" size="sm" onClick={handleCreateFolder} disabled={!!connectionError}>
                    {t('imageUploaderCreateFolder')} {/* Use translation key */}
                  </Button>
                  <Button variant="outline" size="sm" onClick={loadDirectories}>
                    {t('imageUploaderRefresh')} {/* Use translation key */}
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
              disabled={!!connectionError}
            />
            
            {(!files || files.length === 0) && (
              <p className="text-sm text-gray-500 mt-2">{t('imageUploaderNoFileSelected')}</p>
            )}

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
              disabled={!files || isUploading || !!connectionError}
              className="mt-4"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('imageUploaderUploading')}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {t('imageUploaderUploadTo', { path: currentPath })}
                </>
              )}
            </Button>
          </div>
          
          {uploadedImageUrl && (
            <div className="mt-6 space-y-4">
              <h3 className="font-medium">{t('imageUploaderUploadedImageUrl')}</h3>
              <div className="flex items-center space-x-2">
                <Input
                  value={uploadedImageUrl}
                  readOnly
                  className="flex-1"
                />
                <Button onClick={copyToClipboard} variant="outline">
                  {t('imageUploaderCopy')}
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
