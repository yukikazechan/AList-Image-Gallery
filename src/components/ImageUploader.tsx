import React, { useState, useCallback, useEffect, useRef } from "react"; // Added useRef
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlistService, FileInfo, AuthDetails } from "@/services/alistService";
import { Upload, FolderOpen, ChevronLeft, Loader2, Share2, Lock, Copy } from "lucide-react"; // Added Copy
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose, // Ensure DialogClose is imported
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import { placeholderEncrypt } from '@/lib/placeholderCrypto';

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
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null); 
  const [uploadedImageHttpUrls, setUploadedImageHttpUrls] = useState<string[]>([]); 
  const [imagePreviewSources, setImagePreviewSources] = useState<Record<string, string>>({}); 
  const [directories, setDirectories] = useState<FileInfo[]>([]);
  const [isLoadingDirs, setIsLoadingDirs] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [showUploadEncryptShareDialog, setShowUploadEncryptShareDialog] = useState<boolean>(false);
  const [shareEncryptionPasswordForUpload, setShareEncryptionPasswordForUpload] = useState<string>("");
  const [alistPathToShareFromUploader, setAlistPathToShareFromUploader] = useState<string | null>(null);

  // State for manual copy dialog
  const [showManualCopyDialog, setShowManualCopyDialog] = useState<boolean>(false);
  const [linkToCopyManually, setLinkToCopyManually] = useState<string | null>(null);
  const manualCopyTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showManualCopyDialog && manualCopyTextareaRef.current) {
      manualCopyTextareaRef.current.select();
    }
  }, [showManualCopyDialog]);

  const loadDirectories = useCallback(async () => {
    if (!alistService) {
      setDirectories([]);
      // Error state is handled by the calling useEffect or context
      return;
    }
    setIsLoadingDirs(true);
    setConnectionError(null);
    try {
      // Use directoryPasswords for the currentPath if available
      const passwordForPath = directoryPasswords[currentPath];
      const fetchedFiles = await alistService.listFiles(currentPath, passwordForPath);
      setDirectories(fetchedFiles.filter(file => file.is_dir));
    } catch (error: any) {
      console.error("Error loading directories in ImageUploader:", error);
      const errorMessage = error.message || t('imageUploaderUnknownLoadingError');
      setConnectionError(t('imageUploaderLoadingError') + " " + errorMessage);
      setDirectories([]);
    } finally {
      setIsLoadingDirs(false);
    }
  }, [alistService, currentPath, directoryPasswords, t]);

  useEffect(() => {
    if (alistService) {
      setConnectionError(null); // Clear previous errors when service is available
      loadDirectories();
    } else {
      setDirectories([]);
      setConnectionError(t('imageUploaderCheckSettings'));
    }
  }, [alistService, currentPath, loadDirectories, t]); // directoryPasswords is a dep of loadDirectories

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadedImageHttpUrls([]);
    setImagePreviewSources({});
    if (e.target.files && e.target.files.length > 0) {
      setFiles(e.target.files);
      const firstFile = e.target.files[0];
      if (firstFile.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(firstFile);
      } else {
        setImagePreviewUrl(null); // Not an image, clear preview
        toast.warning(t('imageUploaderOnlyImagesAllowed'));
      }
    } else {
      setFiles(null);
      setImagePreviewUrl(null);
    }
  };

  const handleUpload = useCallback(async () => {
    if (!alistService || !files || files.length === 0) return;
    
    setIsUploading(true);
    setUploadedImageHttpUrls([]);
    setImagePreviewSources({});
    const newUploadedAlistPaths: string[] = [];
    const newPreviewSources: Record<string, string> = {};
    let anyUploadSucceeded = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) {
        toast.warning(t('imageUploaderSkippingNonImage', { fileName: file.name }));
        continue;
      }
      try {
        toast.info(t('imageUploaderUploadingFile', { fileName: file.name, current: i + 1, total: files.length }));
        // Directory password is not typically used for upload; auth is via token
        await alistService.uploadFile(currentPath, file);
        
        const uploadedAlistPath = `${currentPath === '/' ? '' : currentPath}/${file.name}`;
        newUploadedAlistPaths.push(uploadedAlistPath);

        try {
            const directLink = await alistService.getFileLink(uploadedAlistPath);
            if (directLink) {
                const imgResponse = await fetch(directLink);
                if (!imgResponse.ok) {
                    console.warn(`[ImageUploader] Failed to fetch preview for ${uploadedAlistPath} (status: ${imgResponse.status})`);
                    // Still add Alist path, preview will fail gracefully or not show
                } else {
                    const blob = await imgResponse.blob();
                    newPreviewSources[uploadedAlistPath] = URL.createObjectURL(blob);
                }
            }
        } catch (previewError) {
            console.warn(`[ImageUploader] Could not get direct link or fetch preview for ${uploadedAlistPath}:`, previewError);
        }
        anyUploadSucceeded = true;
        toast.success(`${file.name} ${t('uploadSuccess')}`);
      } catch (error: any) {
        console.error("Upload error for file " + file.name + ":", error);
        toast.error(t('imageUploaderUploadFailedForFile', { fileName: file.name, error: error.message }));
      }
    }
    setUploadedImageHttpUrls(newUploadedAlistPaths);
    setImagePreviewSources(newPreviewSources);
    setIsUploading(false);
    if (anyUploadSucceeded) {
        onUploadSuccess();
    }
    // Consider if loadDirectories() should be called here to refresh folder list (e.g., if new files affect dir display)
  }, [alistService, files, currentPath, onUploadSuccess, t, directoryPasswords]);
  
  const handleOpenEncryptShareDialogForUploader = (alistPath: string) => {
    setAlistPathToShareFromUploader(alistPath);
    setShareEncryptionPasswordForUpload(""); 
    setShowUploadEncryptShareDialog(true);
  };

  const copyToClipboardFallback = (text: string) => {
    setLinkToCopyManually(text);
    setShowManualCopyDialog(true);
  };

  const handleCreateEncryptedShareLinkForUploader = () => {
    if (!alistService) {
      toast.error(t('galleryErrorAlistServiceMissing', 'Alist service is not available.'));
      return;
    }
    if (!alistPathToShareFromUploader || !shareEncryptionPasswordForUpload) {
      toast.error(t('imageUploaderErrorPasswordForEncryption', 'Password is required to create an encrypted share link.'));
      return;
    }

    const serverUrl = alistService.getBaseUrl();
    const token = alistService.getCurrentToken();
    const r2CustomDomain = alistService.getR2CustomDomain();

    if (!serverUrl) {
      toast.error(t('imageUploaderErrorAlistConfigMissingForShare', 'Alist server URL is not configured (from service).'));
      return;
    }

    let authDetailsToEncrypt: AuthDetails | null = token ? { token } : (alistService.getIsPublicClient() ? null : null);

    const configToEncrypt: AlistConfigToShare = {
      serverUrl,
      authDetails: authDetailsToEncrypt,
      r2CustomDomain
    };

    try {
      const serializedConfig = JSON.stringify(configToEncrypt);
      const encryptedConfig = placeholderEncrypt(serializedConfig, shareEncryptionPasswordForUpload);

      if (!encryptedConfig) {
        toast.error(t('imageUploaderErrorEncryptionFailed', 'Encryption failed. Could not create share link.'));
        return;
      }

      const viewerLink = `${window.location.origin}/view?path=${encodeURIComponent(alistPathToShareFromUploader)}&c=${encodeURIComponent(encryptedConfig)}`;
      console.log("Generated uploader encrypted link:", viewerLink); // For debugging
      
      navigator.clipboard.writeText(viewerLink)
        .then(() => {
          toast.success(t('imageUploaderEncryptedLinkCopied', 'Encrypted viewer link copied!'));
          toast.info(t('imageUploaderSharePasswordReminder', 'Remember to share the password separately with the recipient.'));
        })
        .catch(err => {
          console.error('Failed to copy uploader encrypted link: ', err);
          toast.error(t('galleryErrorCopyingLinkGeneric', 'Failed to copy link. You may need to do it manually.'));
          copyToClipboardFallback(viewerLink); // Fallback to manual copy dialog
        });
      setShowUploadEncryptShareDialog(false);
      setAlistPathToShareFromUploader(null);
    } catch (error: any) {
      console.error("Error creating encrypted share link for uploader:", error);
      toast.error(`${t('imageUploaderErrorCreatingEncryptedLink', 'Error creating encrypted link:')} ${error.message}`);
    }
  };

  const copyToClipboard = useCallback((urlToCopy: string, originDescription?: string) => {
    console.log(`[ImageUploader] copyToClipboard called. Origin: ${originDescription || 'unknown'}. URL to copy:`, urlToCopy);
    if (urlToCopy) {
      navigator.clipboard.writeText(urlToCopy)
        .then(() => {
          toast.success(`${t('imageUploaderCopy')}: ${urlToCopy.length > 50 ? urlToCopy.substring(0, 47) + '...' : urlToCopy}`);
        })
        .catch(err => {
          console.error(`Failed to copy from ImageUploader: `, err);
          toast.error(t('galleryErrorCopyingLinkGeneric', 'Failed to copy link. You may need to do it manually.'));
          copyToClipboardFallback(urlToCopy);
        });
    } else {
      console.warn('[ImageUploader] copyToClipboard called with empty or null URL.');
      toast.error(t('imageUploaderCopyFailed', 'Copy failed: No URL provided.'));
    }
  }, [t]);

  const handlePathChange = (newPath: string) => {
    onPathChange(newPath); // Propagate path change
    setUploadedImageHttpUrls([]);
    setImagePreviewSources({});
    setImagePreviewUrl(null);
    setFiles(null);
    // loadDirectories() will be called by useEffect due to currentPath change
  };

  const navigateToFolder = (folderName: string) => {
    const newPath = `${currentPath === "/" ? "" : currentPath}/${folderName}`;
    handlePathChange(newPath);
  };

  const navigateUp = () => {
    if (currentPath === "/") return;
    const newPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
    handlePathChange(newPath === "" ? "/" : newPath);
  };

  const handleCreateFolder = async () => {
    if (!alistService) {
      toast.error(t('galleryErrorAlistServiceMissing'));
      return;
    }
    const folderName = window.prompt(t('imageUploaderEnterFolderName'));
    if (folderName && folderName.trim() !== "") {
      try {
        // Directory password is not typically used for folder creation; auth is via token
        await alistService.createFolder(currentPath, folderName.trim());
        toast.success(t('imageUploaderCreateFolderSuccess', { folderName: folderName.trim() }) || `Folder "${folderName.trim()}" created!`);
        loadDirectories(); // Refresh the directory list
      } catch (error: any) {
        console.error("Error creating folder:", error);
        toast.error(t('imageUploaderCreateFolderFailed', { folderName: folderName.trim(), error: error.message }) || `Failed to create folder: ${error.message}`);
      }
    } else if (folderName !== null) { // User pressed OK with empty name
        toast.warning(t('imageUploaderFolderNameCannotBeEmpty', 'Folder name cannot be empty.'));
    }
  };
  
  // The useEffect for imagePreviewSources is removed as its logic
  // is now better integrated into the handleUpload function for more
  // immediate and context-aware preview generation.

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t('imageUploaderTitle')}</CardTitle> 
        <CardDescription>{t('imageUploaderDescription')}</CardDescription> 
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
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
              {uploadedImageHttpUrls.map((alistFilePath, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input value={alistFilePath} readOnly className="flex-1" />
                  <Button onClick={() => handleOpenEncryptShareDialogForUploader(alistFilePath)} variant="outline" title={t('imageUploaderShareWithPasswordTooltip', "Share with password (embeds config)")}>
                    <Share2 className="h-4 w-4 mr-1" /> {t('imageUploaderShareEncryptedButton', 'Share Link')}
                  </Button>
                </div>
              ))}
              {uploadedImageHttpUrls[0] && imagePreviewSources[uploadedImageHttpUrls[0]] && (
                <div className="mt-2">
                  <img src={imagePreviewSources[uploadedImageHttpUrls[0]]} alt={t('imageUploaderUploadedPreviewAlt') || "Uploaded Preview"} className="max-h-64 max-w-full rounded-lg" onError={(e) => { const target = e.currentTarget as HTMLImageElement; console.warn(`[ImageUploader] Image preview failed for src: ${target.src}. Original Alist path was: ${uploadedImageHttpUrls[0]}`); target.style.display = 'none'; toast.error(t('imageUploaderPreviewFailed', {fileName: uploadedImageHttpUrls[0] ? uploadedImageHttpUrls[0].substring(uploadedImageHttpUrls[0].lastIndexOf('/') + 1) : 'unknown file'})); }} />
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
      <Dialog open={showUploadEncryptShareDialog} onOpenChange={setShowUploadEncryptShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('imageUploaderEncryptShareTitle')}</DialogTitle>
            <DialogDescription>{t('imageUploaderEncryptShareDesc')}<br/><strong className="text-xs">{t('imageUploaderEncryptShareWarning')}</strong></DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4"><div className="grid flex-1 gap-2"><Label htmlFor="upload-share-password" className="sr-only">{t('imageUploaderSharePasswordLabel')}</Label><Input id="upload-share-password" type="password" placeholder={t('imageUploaderSharePasswordPlaceholder')} value={shareEncryptionPasswordForUpload} onChange={(e) => setShareEncryptionPasswordForUpload(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleCreateEncryptedShareLinkForUploader()}/></div></div>
          <DialogFooter className="sm:justify-start"><Button type="button" onClick={handleCreateEncryptedShareLinkForUploader} disabled={!shareEncryptionPasswordForUpload}><Lock className="mr-2 h-4 w-4" /> {t('imageUploaderCreateLinkButton')}</Button><Button type="button" variant="ghost" onClick={() => setShowUploadEncryptShareDialog(false)}>{t('imageUploaderCancelButton')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Copy Dialog for ImageUploader */}
      <Dialog open={showManualCopyDialog} onOpenChange={setShowManualCopyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('galleryManualCopyTitle', 'Copy Link Manually')}</DialogTitle>
            <DialogDescription>{t('galleryManualCopyDescription', 'Automatic copy failed. Please select the text below and copy it manually.')}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea ref={manualCopyTextareaRef} value={linkToCopyManually || ""} readOnly className="h-24 text-xs" onFocus={(e) => e.target.select()} />
          </div>
          <DialogFooter className="sm:justify-end">
            <Button type="button" onClick={() => { if (linkToCopyManually) { navigator.clipboard.writeText(linkToCopyManually).then(() => toast.success(t('galleryLinkCopiedToClipboard', 'Link copied!'))).catch(() => toast.error(t('galleryManualCopyFailedAgain', 'Manual copy attempt also failed.'))); } setShowManualCopyDialog(false); }}>
              <Copy className="mr-2 h-4 w-4" /> {t('galleryCopyToClipboardButton', 'Copy to Clipboard')}
            </Button>
            <DialogClose asChild><Button type="button" variant="outline">{t('galleryCloseButton', 'Close')}</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ImageUploader;
