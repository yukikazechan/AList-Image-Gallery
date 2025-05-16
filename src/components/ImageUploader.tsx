
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
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]); // Changed to array
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
    
    // For multiple files, previewing the first one.
    // Consider showing a list of selected files instead of a single preview for a better UX.
    if (selectedFiles && selectedFiles.length > 0) {
      const firstFile = selectedFiles[0];
      if (firstFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(firstFile);
      } else {
        // If the first file is not an image, don't attempt to preview.
        setImagePreviewUrl(null);
      }
    } else {
      setImagePreviewUrl(null);
    }
  };

  const handleUpload = useCallback(async () => {
    if (!alistService || !files || files.length === 0) {
      toast.error(t('imageUploaderSelectFile'));
      return;
    }

    setIsUploading(true);
    setUploadedImageUrls([]); // Clear previous URLs

    let allUploadsSuccessful = true;
    const newUploadedUrls: string[] = [];
    const imageFilesToUpload = Array.from(files).filter(f => f.type.startsWith('image/'));
    const totalImageFiles = imageFilesToUpload.length;

    if (totalImageFiles === 0 && files.length > 0) {
        toast.info(t('imageUploaderNoImagesToUpload'));
        setIsUploading(false);
        setFiles(null);
        setImagePreviewUrl(null);
        return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        if (!file.type.startsWith('image/')) {
          if (files.length === 1) { // Only show skip message if it's not the only file and it's non-image
            toast.info(t('imageUploaderSkippingNonImage', { fileName: file.name }));
          }
          continue;
        }

        toast.info(t('imageUploaderUploadingFile', { fileName: file.name, current: newUploadedUrls.length + 1, total: totalImageFiles }));
        await alistService.uploadFile(currentPath, file);
        
        try {
          const fileLink = await alistService.getFileLink(`${currentPath}${currentPath.endsWith('/') ? '' : '/'}${file.name}`);
          newUploadedUrls.push(fileLink);
        } catch (linkError) {
          console.warn(`Could not get link for ${file.name}:`, linkError);
          // If getting link fails, we might still consider upload successful but without a URL.
          // For simplicity, we'll count it as a partial failure for URL display.
           allUploadsSuccessful = false; // Or handle this more granularly
        }

      } catch (error: any) {
        allUploadsSuccessful = false;
        toast.error(t('imageUploaderUploadFailedForFile', { fileName: file.name, error: error.message || t('imageUploaderUnknownLoadingError') }));
      }
    }

    setIsUploading(false);
    setUploadedImageUrls(newUploadedUrls);

    if (allUploadsSuccessful && newUploadedUrls.length === totalImageFiles && totalImageFiles > 0) {
      toast.success(t('imageUploaderAllFilesUploadedSuccess'));
      onUploadSuccess();
    } else if (newUploadedUrls.length > 0) {
      toast.info(t('imageUploaderSomeFilesUploadedSuccess', { count: newUploadedUrls.length, total: totalImageFiles }));
      onUploadSuccess();
    } else if (totalImageFiles > 0 && newUploadedUrls.length === 0) { // All image files failed
        toast.error(t('imageUploaderAllImageFilesFailedToUpload'));
    } else if (files.length > 0 && totalImageFiles === 0) {
        // This case is handled earlier, but as a fallback
        toast.info(t('imageUploaderNoImagesToUpload'));
    }
    
    setFiles(null);
    setImagePreviewUrl(null);
    loadDirectories();
  }, [alistService, files, currentPath, onUploadSuccess, loadDirectories, t, setUploadedImageUrls]); // Added setUploadedImageUrls to dependencies

  const copyToClipboard = useCallback((urlToCopy: string) => {
    if (urlToCopy) {
      navigator.clipboard.writeText(urlToCopy);
      toast.success(t('imageUploaderCopy'));
    }
  }, [t]);

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

          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-lg p-6 bg-gray-50 dark:bg-slate-800"> {/* Dark mode styles added */}
            <Input
              type="file"
              accept="image/*"
              multiple // Allow multiple file selection
              onChange={handleFileChange}
              className="mb-4"
              disabled={!!connectionError}
            />
            
            {(!files || files.length === 0) && (
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">{t('imageUploaderNoFileSelected')}</p>
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
          
          {uploadedImageUrls.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className="font-medium">{t('imageUploaderUploadedImageUrls')}</h3>
              {uploadedImageUrls.map((url, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={url}
                    readOnly
                    className="flex-1"
                  />
                  <Button onClick={() => copyToClipboard(url)} variant="outline">
                    {t('imageUploaderCopy')}
                  </Button>
                </div>
              ))}
              {/* Optionally, show a preview of the first uploaded image if desired */}
              {uploadedImageUrls[0] && (
                <div className="mt-2">
                  <img
                    src={uploadedImageUrls[0]}
                    alt="Uploaded Preview"
                    className="max-h-64 max-w-full rounded-lg"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ImageUploader;
