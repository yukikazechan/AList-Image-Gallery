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
  const folderInputRef = useRef<HTMLInputElement>(null); // Ref for hidden folder input

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
      setDirectories(fetchedFiles.content.filter(file => file.is_dir));
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

  // Helper function to determine MIME type from filename extension
  const getMimeTypeByFilename = (filename: string): string | undefined => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!ext) return undefined;
    switch (ext) {
      case 'jpg': case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'gif': return 'image/gif';
      case 'webp': return 'image/webp';
      case 'bmp': return 'image/bmp';
      case 'avif': return 'image/avif';
      case 'jxl': return 'image/jxl';
      // Add other image types if necessary
      default: return undefined;
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
    const createdRemoteDirsThisSession = new Set<string>();

    // Helper function to ensure remote path exists
    const ensureRemotePathExists = async (basePath: string, relativePath: string): Promise<string> => {
      if (!relativePath) return basePath; // No sub-directory specified

      const segments = relativePath.split('/').filter(s => s.length > 0);
      let currentCumulativePath = basePath;

      for (const segment of segments) {
        let nextPathToEnsure = currentCumulativePath === '/' ? `/${segment}` : `${currentCumulativePath}/${segment}`;
        // Normalize: remove trailing slash if any, except for root
        if (nextPathToEnsure !== '/' && nextPathToEnsure.endsWith('/')) {
            nextPathToEnsure = nextPathToEnsure.slice(0, -1);
        }

        if (!createdRemoteDirsThisSession.has(nextPathToEnsure)) {
          try {
            console.log(`Attempting to create folder: parentPath="${currentCumulativePath}", name="${segment}" (full: ${nextPathToEnsure})`);
            await alistService.createFolder(currentCumulativePath, segment);
            createdRemoteDirsThisSession.add(nextPathToEnsure);
            toast.info(t('imageUploaderFolderCreatedLog', { folderName: segment }) || `Created remote folder: ${segment}`);
          } catch (e: any) {
            // AList might error if folder exists, or might succeed silently.
            // We'll assume if error, it might be "already exists" or a real problem.
            // A more robust check would inspect the error code/message if Alist provides it.
            // For now, we add to set to avoid retrying, and log warning.
            if (e.message && (e.message.includes("exist") || e.message.includes("file already exists"))) {
                 console.warn(`Folder ${nextPathToEnsure} likely already exists or conflict:`, e.message);
                 createdRemoteDirsThisSession.add(nextPathToEnsure); // Assume it exists now
            } else {
                console.error(`Failed to create remote directory ${nextPathToEnsure}:`, e);
                toast.error(t('imageUploaderCreateRemoteFolderError', { folderName: segment, error: e.message }) || `Error creating remote folder ${segment}: ${e.message}`);
                throw e; // Propagate error to stop upload for this file if path can't be made
            }
          }
        }
        currentCumulativePath = nextPathToEnsure;
      }
      return currentCumulativePath; // This is the final directory for the file
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i] as File & { webkitRelativePath?: string }; // Type assertion for webkitRelativePath

      if (!file.type.startsWith("image/")) {
        toast.warning(t('imageUploaderSkippingNonImage', { fileName: file.name }));
        continue;
      }

      const relativePath = file.webkitRelativePath || file.name;
      const lastSlashIndex = relativePath.lastIndexOf('/');
      const relativeDir = lastSlashIndex > -1 ? relativePath.substring(0, lastSlashIndex) : "";
      const fileName = lastSlashIndex > -1 ? relativePath.substring(lastSlashIndex + 1) : relativePath;
      
      try {
        toast.info(t('imageUploaderUploadingFile', { fileName: fileName, current: i + 1, total: files.length }) + (relativeDir ? ` to ${relativeDir}`: ""));
        
        const targetUploadDir = await ensureRemotePathExists(currentPath, relativeDir);
        
        const originalFileType = file.type; // From the original File object from browser
        const typeFromExtension = getMimeTypeByFilename(fileName);
        const determinedMimeType = typeFromExtension || originalFileType || 'application/octet-stream'; // Fallback strategy

        // Pass fileName explicitly as the desired name on server, and use determinedMimeType
        await alistService.uploadFile(targetUploadDir, new File([file], fileName, {type: determinedMimeType}), fileName);

        const uploadedAlistPath = `${targetUploadDir === '/' ? '' : targetUploadDir}/${fileName}`;
        newUploadedAlistPaths.push(uploadedAlistPath);

        try {
            const directLink = await alistService.getFileLink(uploadedAlistPath);
            if (directLink) {
                const imgResponse = await fetch(directLink);
                if (!imgResponse.ok) {
                    console.warn(`[ImageUploader] Failed to fetch preview for ${uploadedAlistPath} (status: ${imgResponse.status})`);
                } else {
                    const blob = await imgResponse.blob();
                    newPreviewSources[uploadedAlistPath] = URL.createObjectURL(blob);
                }
            }
        } catch (previewError) {
            console.warn(`[ImageUploader] Could not get/fetch preview for ${uploadedAlistPath}:`, previewError);
        }
        anyUploadSucceeded = true;
        toast.success(`${fileName} ${t('uploadSuccess')}`);
      } catch (error: any) {
        console.error(`Upload error for file ${fileName} (path: ${relativePath}):`, error);
        toast.error(t('imageUploaderUploadFailedForFile', { fileName: fileName, error: error.message }));
      }
    }
    setUploadedImageHttpUrls(newUploadedAlistPaths);
    setImagePreviewSources(newPreviewSources);
    setIsUploading(false);
    if (anyUploadSucceeded) {
        onUploadSuccess();
        loadDirectories(); // Refresh directory listing after successful uploads
    }
  }, [alistService, files, currentPath, onUploadSuccess, t, directoryPasswords, loadDirectories]);
  
  const handleOpenEncryptShareDialogForUploader = (alistPath: string) => {
    const enablePasswordless = localStorage.getItem("alist_enable_passwordless_share") === "true";
    const defaultPassword = localStorage.getItem("alist_default_share_password");

    if (enablePasswordless && defaultPassword) {
      // Directly call with path and password, no need to set state for this flow
      handleCreateEncryptedShareLinkForUploader(alistPath, defaultPassword);
    } else {
      setAlistPathToShareFromUploader(alistPath);
      setShareEncryptionPasswordForUpload("");
      setShowUploadEncryptShareDialog(true);
    }
  };

  const copyToClipboardFallback = (text: string) => {
    setLinkToCopyManually(text);
    setShowManualCopyDialog(true);
  };

  const handleCreateEncryptedShareLinkForUploader = (
    pathToShareOverride?: string,
    encryptionPasswordOverride?: string
  ) => {
    if (!alistService) {
      toast.error(t('galleryErrorAlistServiceMissing', 'Alist service is not available.'));
      return;
    }

    const finalPathToShare = pathToShareOverride || alistPathToShareFromUploader;
    const finalEncryptionPassword = encryptionPasswordOverride || shareEncryptionPasswordForUpload;

    if (!finalPathToShare || !finalEncryptionPassword) {
      toast.error(t('imageUploaderErrorPasswordForEncryption', 'Password is required to create an encrypted share link.'));
      // If called from dialog, ensure dialog stays open or gives feedback
      if (!encryptionPasswordOverride && showUploadEncryptShareDialog) {
        // This means it was called from the dialog button without a password
        // The button should ideally be disabled if password field is empty.
        // No need to close dialog here, user needs to input password.
      }
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
      const encryptedConfig = placeholderEncrypt(serializedConfig, finalEncryptionPassword);

      if (!encryptedConfig) {
        toast.error(t('imageUploaderErrorEncryptionFailed', 'Encryption failed. Could not create share link.'));
        return;
      }

      let viewerLink = `${window.location.origin}/view?path=${encodeURIComponent(finalPathToShare)}&c=${encodeURIComponent(encryptedConfig)}`;
      
      const enablePasswordlessSetting = localStorage.getItem("alist_enable_passwordless_share") === "true";
      const defaultPasswordSetting = localStorage.getItem("alist_default_share_password");

      // Check if the *used* password for this link is the default one, for passwordless URL decoration
      if (enablePasswordlessSetting && defaultPasswordSetting && finalEncryptionPassword === defaultPasswordSetting) {
        try {
          const encodedPassword = btoa(finalEncryptionPassword); // Use the actual password used for encryption
          viewerLink += `&pm=1&pk=${encodeURIComponent(encodedPassword)}`;
          // toast.info("Passwordless share link generated."); // Optional: inform user, might be too noisy
        } catch (e) {
          console.error("Error base64 encoding password for passwordless link:", e);
        }
      }
      
      console.log("Generated uploader encrypted link:", viewerLink);
      copyToClipboardFallback(viewerLink); // Always show manual copy dialog first

      navigator.clipboard.writeText(viewerLink)
        .then(() => {
          toast.success(t('imageUploaderEncryptedLinkCopied', 'Encrypted viewer link copied!'));
          if (finalEncryptionPassword) { // Only show reminder if a password was used
            toast.info(t('imageUploaderSharePasswordReminder', 'Remember to share the password separately with the recipient.'));
          }
          // copyToClipboardFallback(viewerLink); // Moved up to always show
        })
        .catch(err => {
          console.error('Failed to copy uploader encrypted link: ', err);
          toast.error(t('galleryErrorCopyingLinkGeneric', 'Failed to copy link. You may need to do it manually.'));
          // copyToClipboardFallback(viewerLink); // Already called above
        });

      // Close dialog only if it was open and we are not overriding (i.e., called from dialog)
      if (!pathToShareOverride && !encryptionPasswordOverride) {
         setShowUploadEncryptShareDialog(false);
      }
      // Reset path to share from uploader state if it was used from state
      if (!pathToShareOverride) {
        setAlistPathToShareFromUploader(null);
      }
      // Password state (shareEncryptionPasswordForUpload) is reset when dialog is opened or if not using dialog.
      // No need to reset shareEncryptionPasswordForUpload here as it's managed by dialog input.

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
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-lg p-6 bg-gray-50 dark:bg-slate-800 space-y-4">
            <p className="text-sm text-gray-600 dark:text-slate-300">{t('imageUploaderSelectPrompt', 'Select image files or a folder to upload:')}</p>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
              <Input // For selecting individual files
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="flex-grow"
                disabled={!!connectionError || isUploading}
              />
              <Button // For selecting a folder
                type="button"
                variant="outline"
                onClick={() => folderInputRef.current?.click()}
                disabled={!!connectionError || isUploading}
                className="flex-grow sm:flex-grow-0"
              >
                <FolderOpen className="mr-2 h-4 w-4" /> {t('imageUploaderUploadFolderButton', 'Select Folder')}
              </Button>
            </div>
            {/* Hidden input for folder selection */}
            <Input
              ref={folderInputRef}
              type="file"
              accept="image/*" // accept might be ignored by browser with webkitdirectory
              multiple
              // @ts-ignore
              webkitdirectory=""
              directory=""
              onChange={handleFileChange}
              className="hidden"
              disabled={!!connectionError || isUploading}
            />
            {(!files || files.length === 0) && (<p className="text-sm text-gray-500 dark:text-slate-400">{t('imageUploaderNoFileSelected')}</p>)}
            {imagePreviewUrl && ( // This preview shows the first selected file, mainly for individual file selection
              <div className="mt-2">
                <img src={imagePreviewUrl} alt="Preview" className="max-h-48 max-w-full rounded-lg"/>
              </div>
            )}
            <Button onClick={handleUpload} disabled={!files || isUploading || !!connectionError} className="w-full sm:w-auto">
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
          <div className="flex items-center space-x-2 py-4"><div className="grid flex-1 gap-2"><Label htmlFor="upload-share-password" className="sr-only">{t('imageUploaderSharePasswordLabel')}</Label><Input id="upload-share-password" type="password" placeholder={t('imageUploaderSharePasswordPlaceholder')} value={shareEncryptionPasswordForUpload} onChange={(e) => setShareEncryptionPasswordForUpload(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') handleCreateEncryptedShareLinkForUploader(undefined, undefined); }}/></div></div>
          <DialogFooter className="sm:justify-start"><Button type="button" onClick={() => handleCreateEncryptedShareLinkForUploader(undefined, undefined)} disabled={!shareEncryptionPasswordForUpload}><Lock className="mr-2 h-4 w-4" /> {t('imageUploaderCreateLinkButton')}</Button><Button type="button" variant="ghost" onClick={() => setShowUploadEncryptShareDialog(false)}>{t('imageUploaderCancelButton')}</Button></DialogFooter>
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
