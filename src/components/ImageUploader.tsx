import React, { useState, useCallback, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlistService, FileInfo, AuthDetails } from "@/services/alistService"; // Added AuthDetails
import { Upload, FolderOpen, ChevronLeft, Loader2, Share2, Lock } from "lucide-react"; // Added Share2, Lock
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { placeholderEncrypt } from '@/lib/placeholderCrypto'; // Import shared encrypt function

// Removed local placeholderEncryptForShare definition

interface AlistConfigToShare {
  serverUrl: string | null;
  authDetails: AuthDetails | null;
  r2CustomDomain?: string;
}

interface ImageUploaderProps {
  alistService: AlistService | null;
  currentPath: string;
  onUploadSuccess: () => void;
  onPathChange: (path: string) => void;
  directoryPasswords: Record<string, string>; 
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  alistService,
  currentPath,
  onUploadSuccess,
  onPathChange,
  directoryPasswords 
}) => {
  const { t } = useTranslation(); 
  console.log('[ImageUploader] Component rendered or re-rendered.'); 

  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null); 
  const [uploadedImageHttpUrls, setUploadedImageHttpUrls] = useState<string[]>([]); 
  const [imagePreviewSources, setImagePreviewSources] = useState<Record<string, string>>({}); 
  const [directories, setDirectories] = useState<FileInfo[]>([]);
  const [isLoadingDirs, setIsLoadingDirs] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // State for the new "encrypt and share" dialog
  const [showUploadEncryptShareDialog, setShowUploadEncryptShareDialog] = useState<boolean>(false);
  const [shareEncryptionPasswordForUpload, setShareEncryptionPasswordForUpload] = useState<string>("");
  const [alistPathToShareFromUploader, setAlistPathToShareFromUploader] = useState<string | null>(null);


  const loadDirectories = useCallback(async () => {
    if (!alistService) {
      console.log("ImageUploader loadDirectories: alistService is null, returning.");
      setDirectories([]); 
      setIsLoadingDirs(false);
      return;
    }
    
    setIsLoadingDirs(true);
    setConnectionError(null);
    
    try {
      const passwordToUse = directoryPasswords[currentPath]; 
      console.log(`ImageUploader loadDirectories: directoryPasswords props:`, directoryPasswords); 
      console.log(`ImageUploader loadDirectories: Loading directories for path: ${currentPath}, using password: ${passwordToUse ? 'yes' : 'no'}`); 
      const filesList = await alistService.listFiles(currentPath, passwordToUse); 
      const dirs = filesList.filter(file => file.is_dir);
      setDirectories(dirs);
    } catch (error: any) {
      console.error("ImageUploader loadDirectories error:", error); 
      setConnectionError(error.message || t('imageUploaderUnknownLoadingError')); 
      toast.error(`${t('imageUploaderLoadingError')} ${error.message || t('imageUploaderUnknownLoadingError')}`); 
      setDirectories([]); 
    } finally {
      setIsLoadingDirs(false);
    }
  }, [alistService, currentPath, directoryPasswords, t]);

  useEffect(() => {
    console.log("ImageUploader useEffect: alistService, currentPath, or directoryPasswords changed", { alistService: !!alistService, currentPath, directoryPasswords: Object.keys(directoryPasswords).length }); 
    if (alistService) {
      loadDirectories();
    } else {
      setDirectories([]); 
    }
  }, [alistService, currentPath, directoryPasswords, loadDirectories]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    setFiles(selectedFiles);
    
    if (selectedFiles && selectedFiles.length > 0) {
      const firstFile = selectedFiles[0];
      if (firstFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(firstFile);
      } else {
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
    console.log('[ImageUploader] handleUpload started. Clearing previous URLs.');
    setUploadedImageHttpUrls([]); 
    setImagePreviewSources({}); 

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
          if (files.length === 1) { 
            toast.info(t('imageUploaderSkippingNonImage', { fileName: file.name }));
          }
          continue;
        }

        toast.info(t('imageUploaderUploadingFile', { fileName: file.name, current: newUploadedUrls.length + 1, total: totalImageFiles }));
        await alistService.uploadFile(currentPath, file);
        
        try {
          // After upload, the fileLink is the Alist path
          const alistFilePath = `${currentPath}${currentPath.endsWith('/') ? '' : '/'}${file.name}`;
          newUploadedUrls.push(alistFilePath); 
        } catch (linkError) { // This catch might not be hit if getFileLink is not called here anymore
          console.warn(`Could not construct Alist path for ${file.name}:`, linkError);
           allUploadsSuccessful = false;
        }

      } catch (error: any) {
        allUploadsSuccessful = false;
        toast.error(t('imageUploaderUploadFailedForFile', { fileName: file.name, error: error.message || t('imageUploaderUnknownLoadingError') }));
      }
    }

    setIsUploading(false);
    console.log('[ImageUploader] handleUpload finished. Setting uploadedImageHttpUrls:', newUploadedUrls);
    setUploadedImageHttpUrls(newUploadedUrls); 

    if (allUploadsSuccessful && newUploadedUrls.length === totalImageFiles && totalImageFiles > 0) {
      toast.success(t('imageUploaderAllFilesUploadedSuccess'));
      onUploadSuccess();
    } else if (newUploadedUrls.length > 0) {
      toast.info(t('imageUploaderSomeFilesUploadedSuccess', { count: newUploadedUrls.length, total: totalImageFiles }));
      onUploadSuccess();
    } else if (totalImageFiles > 0 && newUploadedUrls.length === 0) { 
        toast.error(t('imageUploaderAllImageFilesFailedToUpload'));
    } else if (files.length > 0 && totalImageFiles === 0) {
        toast.info(t('imageUploaderNoImagesToUpload'));
    }
    
    setFiles(null);
    setImagePreviewUrl(null);
    loadDirectories();
  }, [alistService, files, currentPath, onUploadSuccess, loadDirectories, t]);


  const handleOpenEncryptShareDialogForUploader = (alistPath: string) => {
    setAlistPathToShareFromUploader(alistPath);
    setShareEncryptionPasswordForUpload(""); 
    setShowUploadEncryptShareDialog(true);
  };

  const handleCreateEncryptedShareLinkForUploader = () => {
    if (!alistPathToShareFromUploader || !shareEncryptionPasswordForUpload) {
      toast.error(t('imageUploaderErrorPasswordForEncryption', 'Password is required to create an encrypted share link.'));
      return;
    }

    const serverUrl = localStorage.getItem("alist_server_url");
    const token = localStorage.getItem("alist_token");
    const username = localStorage.getItem("alist_username");
    const lsPassword = localStorage.getItem("alist_password");
    const r2CustomDomain = localStorage.getItem("alist_r2_custom_domain") || undefined;

    if (!serverUrl) {
      toast.error(t('imageUploaderErrorAlistConfigMissingForShare', 'Alist server URL is not configured. Cannot create share link.'));
      return;
    }

    let authDetailsToEncrypt: AuthDetails | null = null;
    if (token) {
      authDetailsToEncrypt = { token };
    } else if (username) {
      authDetailsToEncrypt = { username, password: lsPassword || "" };
    }

    const configToEncrypt: AlistConfigToShare = {
      serverUrl,
      authDetails: authDetailsToEncrypt,
      r2CustomDomain
    };

    try {
      const serializedConfig = JSON.stringify(configToEncrypt);
      // Use the imported placeholderEncrypt function
      const encryptedConfig = placeholderEncrypt(serializedConfig, shareEncryptionPasswordForUpload);

      if (!encryptedConfig) {
        toast.error(t('imageUploaderErrorEncryptionFailed', 'Encryption failed. Could not create share link.'));
        return;
      }

      const viewerLink = `${window.location.origin}/view?path=${encodeURIComponent(alistPathToShareFromUploader)}&c=${encodeURIComponent(encryptedConfig)}`;
      
      navigator.clipboard.writeText(viewerLink);
      toast.success(t('imageUploaderEncryptedLinkCopied', 'Encrypted viewer link copied!'));
      toast.info(t('imageUploaderSharePasswordReminder', 'Remember to share the password separately with the recipient.'));
      setShowUploadEncryptShareDialog(false);
      setAlistPathToShareFromUploader(null);
    } catch (error: any) {
      console.error("Error creating encrypted share link for uploader:", error);
      toast.error(`${t('imageUploaderErrorCreatingEncryptedLink', 'Error creating encrypted link:')} ${error.message}`);
    }
  };


  // copyToClipboard is no longer used directly by buttons, but kept for potential direct calls or future use.
  // The actual copy logic is now within handleCreateEncryptedShareLinkForUploader or similar.
  const copyToClipboard = useCallback((urlToCopy: string, originDescription?: string) => {
    console.log(`[ImageUploader] copyToClipboard called. Origin: ${originDescription || 'unknown'}. URL to copy:`, urlToCopy);
    if (urlToCopy) {
      navigator.clipboard.writeText(urlToCopy);
      toast.success(`${t('imageUploaderCopy')}: ${urlToCopy.length > 50 ? urlToCopy.substring(0, 47) + '...' : urlToCopy}`);
    } else {
      console.warn('[ImageUploader] copyToClipboard called with empty or null URL.');
      toast.error(t('imageUploaderCopyFailed'));
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
    
    const folderName = prompt(t('imageUploaderEnterFolderName')); 
    if (!folderName) return;
    
    try {
      await alistService.createFolder(currentPath, folderName);
      toast.success(t('imageUploaderCreateFolderSuccess', { folderName })); 
      loadDirectories();
    } catch (error: any) {
      toast.error(`${t('imageUploaderCreateFolderFailed')} ${error.message || t('imageUploaderUnknownLoadingError')}`); 
    }
  };

  useEffect(() => {
    console.log('[ImageUploader] useEffect for imagePreviewSources triggered. uploadedImageHttpUrls:', uploadedImageHttpUrls);
    const newSources: Record<string, string> = {};
    const urlsToProcess = [...uploadedImageHttpUrls]; // These are Alist file paths

    const processUrl = async (alistFilePath: string) => {
      // For ImageUploader, uploadedImageHttpUrls contains Alist paths.
      // We need to get the actual file link from alistService first for preview.
      if (!alistService) return alistFilePath; // Should not happen if service is checked before

      try {
        const httpUrl = await alistService.getFileLink(alistFilePath);
        if (!httpUrl) return alistFilePath; // Fallback if no link

        if (httpUrl.includes("sharepoint.com") && (httpUrl.includes("download.aspx") || httpUrl.includes("/personal/"))) {
          console.log(`[ImageUploader] Attempting to fetch for blob preview: ${httpUrl}`);
          const response = await fetch(httpUrl);
          if (!response.ok) {
            throw new Error(`Network response was not ok for preview: ${response.status} ${response.statusText} for URL: ${httpUrl}`);
          }
          const blobData = await response.blob();
          if (!blobData.type.startsWith('image/')) {
            console.warn(`[ImageUploader] Fetched content for ${httpUrl} may not be an image. Type: ${blobData.type}. Creating blob URL anyway.`);
          }
          const blobUrl = URL.createObjectURL(blobData);
          console.log(`[ImageUploader] Created blob URL ${blobUrl} for ${httpUrl} (original path: ${alistFilePath})`);
          return blobUrl;
        }
        return httpUrl; // Directly useable URL for other cases
      } catch (error) {
        console.error(`[ImageUploader] Failed to process URL for preview ${alistFilePath}:`, error);
        return alistFilePath; // Fallback to Alist path, which won't render
      }
    };

    const updateSources = async () => {
      console.log('[ImageUploader] updateSources called with Alist paths to process:', urlsToProcess);
      const processedSourcesPromises = urlsToProcess.map(alistPath =>
        processUrl(alistPath).then(processedUrl => ({ key: alistPath, value: processedUrl }))
      );
      const resolvedSourcesArray = await Promise.all(processedSourcesPromises);
      const finalProcessedSources: Record<string, string> = {};
      resolvedSourcesArray.forEach(item => {
        finalProcessedSources[item.key] = item.value;
      });

      console.log('[ImageUploader] Setting imagePreviewSources to:', finalProcessedSources);
      setImagePreviewSources(currentSources => {
        const oldKeys = Object.keys(currentSources);
        oldKeys.forEach(oldKey => {
          const oldSrc = currentSources[oldKey];
          if (oldSrc.startsWith('blob:') && (!finalProcessedSources[oldKey] || finalProcessedSources[oldKey] !== oldSrc)) {
            URL.revokeObjectURL(oldSrc);
            console.log(`[ImageUploader] Revoked old blob URL: ${oldSrc} (was for ${oldKey})`);
          }
        });
        return finalProcessedSources;
      });
    };

    if (urlsToProcess.length > 0 && alistService) { // Ensure alistService is available
      updateSources();
    } else {
      console.log('[ImageUploader] No URLs to process or alistService not ready, clearing and revoking imagePreviewSources.');
      setImagePreviewSources(currentSources => {
        Object.values(currentSources).forEach(oldSrc => {
          if (oldSrc.startsWith('blob:')) {
            URL.revokeObjectURL(oldSrc);
          }
        });
        return {};
      });
    }
    
    return () => {
      const sourcesAtUnmount = imagePreviewSources; 
      Object.values(sourcesAtUnmount).forEach(src => {
        if (src.startsWith('blob:')) {
          URL.revokeObjectURL(src);
          console.log(`[ImageUploader] Revoked blob URL on unmount: ${src}`);
        }
      });
    };
  }, [uploadedImageHttpUrls, alistService]); 

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t('imageUploaderTitle')}</CardTitle> 
        <CardDescription>{t('imageUploaderDescription')}</CardDescription> 
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* ... (Connection error, path navigation, file input, local preview JSX remains same) ... */}
          {connectionError && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded relative mb-4">
              <strong className="font-bold">{t('imageUploaderConnectionError')} </strong>
              <span className="block sm:inline">{connectionError}</span>
              <p className="mt-2 text-sm">{t('imageUploaderCheckSettings')}</p>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={navigateUp} disabled={currentPath === "/"}>
                <ChevronLeft className="h-4 w-4 mr-1" />{t('imageUploaderUp')}
              </Button>
              <span className="text-sm font-medium">{t('imageUploaderCurrentPath')} {currentPath}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {isLoadingDirs ? (
                <div className="flex items-center space-x-2"><Loader2 className="h-4 w-4 animate-spin" /><span>{t('imageUploaderLoadingDirs')}</span></div>
              ) : (
                <>
                  {directories.length === 0 ? (
                    <p className="text-sm text-gray-500">{connectionError ? t('imageUploaderCouldNotLoadDirs') : t('imageUploaderNoSubfolders')}</p>
                  ) : (
                    <Select onValueChange={navigateToFolder}>
                      <SelectTrigger className="w-[250px]"><SelectValue placeholder={t('imageUploaderSelectFolder')} /></SelectTrigger>
                      <SelectContent>{directories.map((dir) => (<SelectItem key={dir.name} value={dir.name}><div className="flex items-center"><FolderOpen className="h-4 w-4 mr-2 text-yellow-500" />{dir.name}</div></SelectItem>))}</SelectContent>
                    </Select>
                  )}
                  <Button variant="outline" size="sm" onClick={handleCreateFolder} disabled={!!connectionError}>{t('imageUploaderCreateFolder')}</Button>
                  <Button variant="outline" size="sm" onClick={loadDirectories}>{t('imageUploaderRefresh')}</Button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-lg p-6 bg-gray-50 dark:bg-slate-800">
            <Input type="file" accept="image/*" multiple onChange={handleFileChange} className="mb-4" disabled={!!connectionError} />
            {(!files || files.length === 0) && (<p className="text-sm text-gray-500 dark:text-slate-400 mt-2">{t('imageUploaderNoFileSelected')}</p>)}
            {imagePreviewUrl && (<div className="mt-4"><img src={imagePreviewUrl} alt="Preview" className="max-h-64 max-w-full rounded-lg"/></div>)}
            <Button onClick={handleUpload} disabled={!files || isUploading || !!connectionError} className="mt-4">
              {isUploading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('imageUploaderUploading')}</>) : (<><Upload className="mr-2 h-4 w-4" />{t('imageUploaderUploadTo', { path: currentPath })}</>)}
            </Button>
          </div>
          
          {uploadedImageHttpUrls.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className="font-medium">{t('imageUploaderUploadedImageUrls')}</h3>
              {uploadedImageHttpUrls.map((alistFilePath, index) => ( // alistFilePath is the path on Alist
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={alistFilePath} 
                    readOnly
                    className="flex-1"
                    // id={`uploaded-url-input-${index}`} // ID was removed in previous diff, re-check if needed
                  />
                  {/* MODIFIED Button to open encrypt share dialog */}
                  <Button
                    onClick={() => {
                      console.log(`[ImageUploader] Share button clicked for Alist path:`, alistFilePath);
                      handleOpenEncryptShareDialogForUploader(alistFilePath);
                    }}
                    variant="outline"
                    title={t('imageUploaderShareWithPasswordTooltip', "Share with password (embeds config)")}
                  >
                    <Share2 className="h-4 w-4 mr-1" /> {/* Using Share2 icon */}
                    {t('imageUploaderShareEncryptedButton', 'Share Link')}
                  </Button>
                </div>
              ))}
              {uploadedImageHttpUrls[0] && imagePreviewSources[uploadedImageHttpUrls[0]] && (
                <div className="mt-2">
                  <img
                    src={imagePreviewSources[uploadedImageHttpUrls[0]]} 
                    alt={t('imageUploaderUploadedPreviewAlt') || "Uploaded Preview"} 
                    className="max-h-64 max-w-full rounded-lg"
                    onError={(e) => { 
                      const target = e.currentTarget as HTMLImageElement;
                      console.warn(`[ImageUploader] Image preview failed for src: ${target.src}. Original Alist path was: ${uploadedImageHttpUrls[0]}`);
                      target.style.display = 'none'; 
                      toast.error(t('imageUploaderPreviewFailed', {fileName: uploadedImageHttpUrls[0] ? uploadedImageHttpUrls[0].substring(uploadedImageHttpUrls[0].lastIndexOf('/') + 1) : 'unknown file'}));
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
      {/* Dialog for Encrypt Share Link Password Input */}
      <Dialog open={showUploadEncryptShareDialog} onOpenChange={setShowUploadEncryptShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('imageUploaderEncryptShareTitle', 'Create Encrypted Share Link')}</DialogTitle>
            <DialogDescription>
              {t('imageUploaderEncryptShareDesc', 'Enter a password to encrypt the Alist configuration for this share link. You will need to share this password separately with the recipient.')}
              <br/>
              <strong className="text-xs">{t('imageUploaderEncryptShareWarning', "Note: The security of this link depends on the password's strength and its confidential transmission. Client-side encryption has limitations.")}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="upload-share-password" className="sr-only">
                {t('imageUploaderSharePasswordLabel', 'Password')}
              </Label>
              <Input
                id="upload-share-password"
                type="password"
                placeholder={t('imageUploaderSharePasswordPlaceholder', 'Enter temporary password')}
                value={shareEncryptionPasswordForUpload}
                onChange={(e) => setShareEncryptionPasswordForUpload(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateEncryptedShareLinkForUploader()}
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button type="button" onClick={handleCreateEncryptedShareLinkForUploader} disabled={!shareEncryptionPasswordForUpload}>
              <Lock className="mr-2 h-4 w-4" /> {t('imageUploaderCreateLinkButton', 'Create & Copy Link')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowUploadEncryptShareDialog(false)}>
              {t('imageUploaderCancelButton', 'Cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ImageUploader;
