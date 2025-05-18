import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { AlistService, FileInfo, AuthDetails } from "@/services/alistService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft,
  FolderOpen,
  Image as ImageIcon,
  Link,
  Trash2,
  Loader2,
  KeyRound,
  Share2, 
  Lock,
  LibraryBig
} from "lucide-react";
import { toast } from "sonner";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { useTranslation } from 'react-i18next';
import { placeholderEncrypt } from '@/lib/placeholderCrypto';

interface AlistConfigToShare {
  serverUrl: string | null;
  authDetails: AuthDetails | null;
  r2CustomDomain?: string;
  imagePaths?: string[]; 
}

interface GalleryProps {
  alistService: AlistService | null;
  path: string;
  onPathChange: (path: string) => void;
  directoryPasswords: Record<string, string>; 
  setDirectoryPasswords: React.Dispatch<React.SetStateAction<Record<string, string>>>; 
}

const Gallery: React.FC<GalleryProps> = ({ alistService, path, onPathChange, directoryPasswords, setDirectoryPasswords }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalFileUrl, setOriginalFileUrl] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<FileInfo | null>(null);
  const [showFullImage, setShowFullImage] = useState<boolean>(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);

  const [showPasswordDialog, setShowPasswordDialog] = useState<boolean>(false);
  const [passwordPromptPath, setPasswordPromptPath] = useState<string>("");
  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [showEncryptShareDialog, setShowEncryptShareDialog] = useState<boolean>(false);
  const [shareEncryptionPassword, setShareEncryptionPassword] = useState<string>("");
  const [fileToShare, setFileToShare] = useState<FileInfo | null>(null);

  const [selectedFilePaths, setSelectedFilePaths] = useState<string[]>([]);
  const [showMultiShareEncryptDialog, setShowMultiShareEncryptDialog] = useState<boolean>(false);
  const [multiShareEncryptionPassword, setMultiShareEncryptionPassword] = useState<string>("");
  const [imagePathsForGalleryShare, setImagePathsForGalleryShare] = useState<string[]>([]);
  const [isResolvingPaths, setIsResolvingPaths] = useState<boolean>(false);

  const [manualCopyLink, setManualCopyLink] = useState<string | null>(null);
  const [showManualCopyDialog, setShowManualCopyDialog] = useState<boolean>(false);

  const isImageFile = useCallback((file: FileInfo) => !file.is_dir && file.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|avif)$/i), []);
  
  const allDisplayedItemPaths = useMemo(() => files.map(f => `${path}${path.endsWith('/') ? '' : '/'}${f.name}`), [files, path]);
  const isAllSelected = useMemo(() => files.length > 0 && selectedFilePaths.length === allDisplayedItemPaths.length, [selectedFilePaths, allDisplayedItemPaths, files.length]);

  const loadFiles = useCallback(async (currentPathToLoad?: string, dirPassword?: string) => {
    if (!alistService) { setFiles([]); setLoading(false); return; }
    const pathToLoad = currentPathToLoad || path;
    setLoading(true);
    setPasswordError(null); 
    try {
      const passwordToUse = dirPassword || directoryPasswords[pathToLoad];
      const filesList = await alistService.listFiles(pathToLoad, passwordToUse);
      setFiles(filesList); 
      if (passwordToUse && pathToLoad === passwordPromptPath) { setShowPasswordDialog(false); setCurrentPasswordInput(""); }
    } catch (error: any) {
      const errorMessage = error.message || t('galleryUnknownError');
      const lowerErrorMessage = errorMessage.toLowerCase();
      const isPasswordError = lowerErrorMessage.includes("password") && (lowerErrorMessage.includes("incorrect") || lowerErrorMessage.includes("permission") || lowerErrorMessage.includes("required") || lowerErrorMessage.includes("denied") || lowerErrorMessage.includes("unauthorized"));
      const isObjectNotFoundError = lowerErrorMessage.includes("object not found") || lowerErrorMessage.includes("failed get dir");
      if (isPasswordError || isObjectNotFoundError) {
        setPasswordPromptPath(pathToLoad); setShowPasswordDialog(true);
        if (lowerErrorMessage.includes("incorrect") || lowerErrorMessage.includes("permission") || (isObjectNotFoundError && directoryPasswords[pathToLoad])) {
            setPasswordError(t('galleryPasswordIncorrectOrNoPermission'));
        } else if (isObjectNotFoundError) { setPasswordError(t('galleryPasswordOrPathInvalid')); }
        else { setPasswordError(t('galleryPasswordPossiblyRequired'));}
        setFiles([]);
      } else { toast.error(`${t('galleryErrorLoadingFiles')} ${errorMessage}`); setFiles([]); }
    } finally { setLoading(false); }
  }, [alistService, path, t, directoryPasswords, passwordPromptPath]);

  useEffect(() => {
    setSelectedFilePaths([]); 
    if (alistService) { loadFiles(); } else { setFiles([]); }
    return () => { if (currentImageUrl && currentImageUrl.startsWith('blob:')) { URL.revokeObjectURL(currentImageUrl); }};
  }, [alistService, path, loadFiles]);

  const handlePasswordSubmit = () => {
    if (!passwordPromptPath || !currentPasswordInput) return;
    setDirectoryPasswords(prev => ({ ...prev, [passwordPromptPath]: currentPasswordInput }));
    loadFiles(passwordPromptPath, currentPasswordInput);
  };

  const handleNavigate = (file: FileInfo) => {
    if (file.is_dir) { onPathChange(`${path}${path.endsWith('/') ? '' : '/'}${file.name}`); } 
    else { handleViewImage(file); }
  };
  
  const getMimeType = useCallback((fileExtension?: string): string | undefined => {
    if (!fileExtension) return undefined;
    switch (fileExtension) {
      case 'jpg': case 'jpeg': return 'image/jpeg'; case 'png': return 'image/png';
      case 'gif': return 'image/gif'; case 'webp': return 'image/webp';
      case 'bmp': return 'image/bmp'; case 'avif': return 'image/avif';
      default: return undefined;
    }
  }, []);

  const handleViewImage = async (file: FileInfo) => {
    if (!alistService) return;
    setIsPreviewLoading(true); setCurrentFile(file); 
    if (currentImageUrl && currentImageUrl.startsWith('blob:')) { URL.revokeObjectURL(currentImageUrl); }
    setCurrentImageUrl(null); setOriginalFileUrl(null);
    try {
      const alistFilePath = `${path}${path.endsWith('/') ? '' : '/'}${file.name}`;
      const directUrl = await alistService.getFileLink(alistFilePath);
      setOriginalFileUrl(directUrl); 
      try {
        const response = await fetch(directUrl);
        if (!response.ok) { console.warn(`Failed to fetch image as blob (${response.status} ${response.statusText}), falling back to direct URL for: ${directUrl}`); setCurrentImageUrl(directUrl); } 
        else {
          const blob = await response.blob(); let typedBlob = blob;
          const fileExtension = file.name.split('.').pop()?.toLowerCase();
          const correctMimeType = getMimeType(fileExtension); 
          if (!blob.type.startsWith('image/') && correctMimeType) { try { typedBlob = new Blob([blob], { type: correctMimeType }); } catch (blobError) { console.error("Error creating typed blob:", blobError); }}
          const blobUrl = URL.createObjectURL(typedBlob); setCurrentImageUrl(blobUrl);
        }
      } catch (fetchError: any) { console.warn(`Error fetching image for blob: ${fetchError.message}. Falling back to direct URL: ${directUrl}`); setCurrentImageUrl(directUrl); }
    } catch (error: any) { toast.error(`${t('galleryErrorGettingImageLink')} ${error.message || t('galleryUnknownError')}`); } 
    finally { setIsPreviewLoading(false); }
  };

  const handleOpenEncryptShareDialog = (file: FileInfo) => { setFileToShare(file); setShareEncryptionPassword(""); setShowEncryptShareDialog(true); };

  const handleCreateEncryptedShareLink = () => {
    if (!alistService) { toast.error(t('galleryErrorAlistServiceMissing', 'Alist service is not available.')); return; }
    if (!fileToShare || !shareEncryptionPassword) { toast.error(t('galleryErrorPasswordForEncryption')); return; }
    const serverUrl = alistService.getBaseUrl();
    const token = alistService.getCurrentToken();
    const r2CustomDomain = alistService.getR2CustomDomain();
    if (!serverUrl) { toast.error(t('galleryErrorAlistConfigMissingForShare', 'Alist server URL is not configured (from service).')); return; }
    let authDetailsToEncrypt: AuthDetails | null = token ? { token } : (alistService.getIsPublicClient() ? null : null);
    const configToEncrypt: AlistConfigToShare = { serverUrl, authDetails: authDetailsToEncrypt, r2CustomDomain };
    try {
      const encryptedConfig = placeholderEncrypt(JSON.stringify(configToEncrypt), shareEncryptionPassword);
      if (!encryptedConfig) { toast.error(t('galleryErrorEncryptionFailed')); return; }
      const alistFilePath = `${path}${path.endsWith('/') ? '' : '/'}${fileToShare.name}`;
      const viewerLink = `${window.location.origin}/view?path=${encodeURIComponent(alistFilePath)}&c=${encodeURIComponent(encryptedConfig)}`;
      navigator.clipboard.writeText(viewerLink)
        .then(() => {
          toast.success(t('galleryEncryptedLinkCopied') + (isMobile ? " " + t('galleryMobileCopyPrompt', 'Please try pasting. If it fails, you may need to copy it manually.') : ""));
          toast.info(t('gallerySharePasswordReminder'));
          // Always show manual copy dialog as a reliable option
          setManualCopyLink(viewerLink);
          setShowManualCopyDialog(true);
        })
        .catch(err => {
          console.error('Failed to copy encrypted link: ', err);
          toast.error(t('galleryErrorCopyingLinkGeneric', 'Failed to copy link. You may need to do it manually.'));
          setManualCopyLink(viewerLink); // Show dialog on error for all platforms
          setShowManualCopyDialog(true);
        });
      setShowEncryptShareDialog(false); setFileToShare(null);
    } catch (e:any) { console.error("Err creating encrypted link:", e); toast.error(`${t('galleryErrorCreatingEncryptedLink')} ${e.message}`); }
  };

  const resolvePathsForGalleryShare = async (selectedPaths: string[]): Promise<string[]> => {
    if (!alistService) return [];
    setIsResolvingPaths(true);
    toast.info(t('galleryResolvingFolderPaths', 'Resolving folder contents for gallery...'));
    const resolvedImagePaths: string[] = [];
    for (const selectedPath of selectedPaths) {
      const fileEntry = files.find(f => `${path}${path.endsWith('/') ? '' : '/'}${f.name}` === selectedPath);
      if (fileEntry) {
        if (fileEntry.is_dir) {
          try {
            const dirContents = await alistService.listFiles(selectedPath, directoryPasswords[selectedPath]);
            dirContents.filter(isImageFile).forEach(imgFile => {
              resolvedImagePaths.push(`${selectedPath}${selectedPath.endsWith('/') ? '' : '/'}${imgFile.name}`);
            });
          } catch (e) { console.error(`Error listing contents of folder ${selectedPath}:`, e); toast.error(t('galleryErrorListingFolderContents', { folderName: fileEntry.name })); }
        } else if (isImageFile(fileEntry)) {
          resolvedImagePaths.push(selectedPath);
        }
      }
    }
    setIsResolvingPaths(false);
    if (resolvedImagePaths.length === 0 && selectedPaths.length > 0) { toast.warning(t('galleryNoImagesFoundInSelection')); }
    return [...new Set(resolvedImagePaths)];
  };

  const handleOpenMultiShareDialog = async () => {
    if (selectedFilePaths.length === 0) { toast.info(t('galleryNoFilesSelectedForMultiShare')); return; }
    const resolvedPaths = await resolvePathsForGalleryShare(selectedFilePaths);
    if (resolvedPaths.length === 0 && selectedFilePaths.length > 0) { return; }
    if (resolvedPaths.length === 0) { toast.info(t('galleryNoImagesToShareAfterResolution', 'No images to share after resolving selection.')); return;}
    setImagePathsForGalleryShare(resolvedPaths);
    setMultiShareEncryptionPassword(""); 
    setShowMultiShareEncryptDialog(true);
  };
  
  const handleCreateEncryptedMultiShareLink = () => {
    if (!alistService) { toast.error(t('galleryErrorAlistServiceMissing', 'Alist service is not available.')); return; }
    if (imagePathsForGalleryShare.length === 0 || !multiShareEncryptionPassword) { toast.error(t('galleryErrorPasswordOrFilesForMultiShare')); return; }
    const serverUrl = alistService.getBaseUrl();
    const token = alistService.getCurrentToken();
    const r2CustomDomain = alistService.getR2CustomDomain();
    if (!serverUrl) { toast.error(t('galleryErrorAlistConfigMissingForShare', 'Alist server URL is not configured (from service).')); return; }
    let authDetailsToEncrypt: AuthDetails | null = token ? { token } : (alistService.getIsPublicClient() ? null : null);
    const configToEncrypt: AlistConfigToShare = { serverUrl, authDetails: authDetailsToEncrypt, r2CustomDomain, imagePaths: imagePathsForGalleryShare };
    try {
      const encryptedConfig = placeholderEncrypt(JSON.stringify(configToEncrypt), multiShareEncryptionPassword);
      if (!encryptedConfig) { toast.error(t('galleryErrorEncryptionFailed')); return; }
      const viewerLink = `${window.location.origin}/view?type=gallery&c=${encodeURIComponent(encryptedConfig)}`;
      navigator.clipboard.writeText(viewerLink)
        .then(() => {
          toast.success(t('galleryMultiEncryptedLinkCopied') + (isMobile ? " " + t('galleryMobileCopyPrompt', 'Please try pasting. If it fails, you may need to copy it manually.') : ""));
          toast.info(t('gallerySharePasswordReminder'));
          // Always show manual copy dialog as a reliable option
          setManualCopyLink(viewerLink);
          setShowManualCopyDialog(true);
        })
        .catch(err => {
          console.error('Failed to copy multi-share encrypted link: ', err);
          toast.error(t('galleryErrorCopyingLinkGeneric', 'Failed to copy link. You may need to do it manually.'));
          setManualCopyLink(viewerLink); // Show dialog on error for all platforms
          setShowManualCopyDialog(true);
        });
      setShowMultiShareEncryptDialog(false); setSelectedFilePaths([]); setImagePathsForGalleryShare([]);
    } catch (e:any) { console.error("Err creating multi-share link:", e); toast.error(`${t('galleryErrorCreatingEncryptedLink')} ${e.message}`);}
  };

  const generateViewerLink = (filePath: string) => `${window.location.origin}/view?path=${encodeURIComponent(filePath)}`;
  
  const copyHelper = (contentToCopy: string, successMsgKey: string, errorMsgKey: string = 'galleryErrorCopyingLinkGeneric') => {
    navigator.clipboard.writeText(contentToCopy)
      .then(() => {
        toast.success(t(successMsgKey) + (isMobile ? " " + t('galleryMobileCopyPrompt', 'Please try pasting. If it fails, you may need to copy it manually.') : ""));
        // Always show manual copy dialog as a reliable option
        setManualCopyLink(contentToCopy);
        setShowManualCopyDialog(true);
      })
      .catch(err => {
        console.error(`Failed to copy (${successMsgKey}): `, err);
        toast.error(t(errorMsgKey, 'Failed to copy link. You may need to do it manually.'));
        setManualCopyLink(contentToCopy); // Show dialog on error for all platforms
        setShowManualCopyDialog(true);
      });
  };

  const handleCopyLink = (file: FileInfo) => {
    const alistFilePath = `${path}${path.endsWith('/') ? '' : '/'}${file.name}`;
    const viewerLink = generateViewerLink(alistFilePath);
    if (viewerLink) copyHelper(viewerLink, 'imageLinkCopied');
    else toast.error(t('galleryErrorCopyingLink'));
  };

  const handleCopyMarkdownLink = (file: FileInfo) => {
    const alistFilePath = `${path}${path.endsWith('/') ? '' : '/'}${file.name}`;
    const viewerLink = generateViewerLink(alistFilePath);
    if(viewerLink) copyHelper(`![${file.name}](${viewerLink})`, 'markdownLinkCopied');
    else toast.error(t('galleryErrorCopyingMarkdownLink'));
  };

  const handleCopyHtmlLink = (file: FileInfo) => {
    const alistFilePath = `${path}${path.endsWith('/') ? '' : '/'}${file.name}`;
    const viewerLink = generateViewerLink(alistFilePath);
    if(viewerLink) copyHelper(`<img src="${viewerLink}" alt="${file.name}">`, 'htmlLinkCopied');
    else toast.error(t('galleryErrorCopyingHtmlLink'));
  };

  const handleCopyUbbLink = (file: FileInfo) => {
    const alistFilePath = `${path}${path.endsWith('/') ? '' : '/'}${file.name}`;
    const viewerLink = generateViewerLink(alistFilePath);
    if(viewerLink) copyHelper(`[img]${viewerLink}[/img]`, 'ubbLinkCopied');
    else toast.error(t('galleryErrorCopyingUbbLink'));
  };

  const handleCopyThumbnailLink = async (file: FileInfo) => {
    if (!file.thumb) { toast.error(t('galleryThumbnailUrlNotAvailable')); return; }
    copyHelper(file.thumb, 'thumbnailLinkCopied', 'galleryErrorCopyingThumbnailLink');
  };

  const handleDelete = async (file: FileInfo) => {
    if (!alistService) return;
    const fullPath = `${path}${path.endsWith('/') ? '' : '/'}${file.name}`;
    const confirmMessageKey = file.is_dir ? 'galleryConfirmDeleteFolder' : 'galleryConfirmDelete';
    const confirmMessage = t(confirmMessageKey, { folderName: file.name, fileName: file.name });
    if (!window.confirm(confirmMessage)) return;
    try {
      await alistService.deleteFile(fullPath); 
      toast.success(t('galleryDeleteSuccess', { fileName: file.name })); 
      loadFiles(); 
      setSelectedFilePaths(prev => prev.filter(p => p !== fullPath)); 
    } catch (error: any) { toast.error(`${t('galleryErrorDeletingFile')} ${error.message || t('galleryUnknownError')}`); }
  };

  const handleDeleteSelected = async () => {
    if (selectedFilePaths.length === 0 || !alistService) { toast.info(t('galleryNoFilesSelectedForDelete')); return; }
    const containsFolder = selectedFilePaths.some(fp => files.find(f => `${path}${path.endsWith('/') ? '' : '/'}${f.name}` === fp)?.is_dir);
    const confirmMessage = containsFolder ? 
        t('galleryConfirmDeleteSelectedWithFolders', { count: selectedFilePaths.length }) :
        t('galleryConfirmDeleteSelected', { count: selectedFilePaths.length });
    if (!window.confirm(confirmMessage)) return;
    try {
      toast.info(t('galleryDeletingSelectedFiles', { count: selectedFilePaths.length }));
      const result = await alistService.deleteMultipleFiles(selectedFilePaths);
      let successCount = 0; let failCount = 0;
      result.results.forEach(r => r.success ? successCount++ : failCount++);
      if (result.success) { toast.success(t('galleryDeleteSelectedSuccessCount', { successCount })); }
      else if (successCount > 0) { toast.warning(t('galleryDeleteSelectedPartialSuccess', { successCount, failCount })); result.results.filter(r => !r.success).forEach(r => console.error(`Failed to delete ${r.path}: ${r.error}`));}
      else { toast.error(t('galleryDeleteSelectedFailedCount', { failCount })); result.results.filter(r => !r.success).forEach(r => console.error(`Failed to delete ${r.path}: ${r.error}`));}
    } catch (error: any) { toast.error(`${t('galleryErrorDeletingSelected')} ${error.message}`); } 
    finally { loadFiles(); setSelectedFilePaths([]); }
  };

  const navigateUp = () => {
    if (path === "/") return;
    const newPath = path.split("/").slice(0, -1).join("/") || "/";
    onPathChange(newPath);
  };
 
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
           {files.length > 0 && (
            <div className="flex items-center space-x-1.5 sm:space-x-2 mr-2">
              <Checkbox
                id="select-all-gallery"
                checked={isAllSelected}
                onCheckedChange={(checked) => {
                  if (checked) { setSelectedFilePaths(allDisplayedItemPaths); } 
                  else { setSelectedFilePaths([]); }
                }}
                aria-label={isAllSelected ? t('galleryDeselectAll', 'Deselect All') : t('gallerySelectAll', 'Select All')}
              />
              <Label htmlFor="select-all-gallery" className="text-xs sm:text-sm cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                {isAllSelected ? t('galleryDeselectAll', 'Deselect All') : t('gallerySelectAll', 'Select All')}
              </Label>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={navigateUp} disabled={path === "/"}>
            <ChevronLeft className="h-4 w-4 mr-1" />{t('galleryUp')}
          </Button>
          <span className="text-sm font-medium hidden sm:inline">{t('galleryCurrentPath')} {path}</span>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap gap-y-2">
          {path !== "/" && (<Button variant="outline" size="sm" onClick={() => { setPasswordPromptPath(path); setCurrentPasswordInput(directoryPasswords[path] || ""); setShowPasswordDialog(true); setPasswordError(null); }}><KeyRound className="h-4 w-4 mr-1" />{t('galleryEnterPassword')}</Button>)}
          <Button variant="outline" size="sm" onClick={() => loadFiles()}>{t('galleryRefresh')}</Button>
          <Button variant="default" size="sm" onClick={handleOpenMultiShareDialog} disabled={selectedFilePaths.length === 0 || isResolvingPaths} title={t('galleryShareSelectedTooltip')}>
            {isResolvingPaths ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <LibraryBig className="h-4 w-4 mr-1" />}
            {t('galleryShareSelectedButton', 'Share ({{count}})', { count: selectedFilePaths.length })}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={selectedFilePaths.length === 0 || loading || isResolvingPaths} title={t('galleryDeleteSelectedTooltip')}><Trash2 className="h-4 w-4 mr-1" />{t('galleryDeleteSelectedButton', 'Delete ({{count}})', { count: selectedFilePaths.length })}</Button>
        </div>
      </div>

      <Dialog open={showPasswordDialog} onOpenChange={(isOpen) => { setShowPasswordDialog(isOpen); if (!isOpen) { setPasswordError(null); setCurrentPasswordInput("");}}}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>{t('galleryPasswordRequiredTitle')}</DialogTitle><DialogDescription>{t('galleryPasswordRequiredDesc', { path: passwordPromptPath })}{passwordError && <p className="text-red-500 text-sm mt-2">{passwordError}</p>}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="dir-password" className="text-right">{t('galleryPasswordLabel')}</Label><Input id="dir-password" type="password" value={currentPasswordInput} onChange={(e) => setCurrentPasswordInput(e.target.value)} className="col-span-3" onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}/></div></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => {setShowPasswordDialog(false); setPasswordError(null); setCurrentPasswordInput("");}}>{t('galleryPasswordDialogCancelButton')}</Button><Button type="submit" onClick={handlePasswordSubmit}>{t('galleryPasswordDialogSubmitButton')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {loading && !isResolvingPaths ? ( <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-gray-500" /></div> ) : 
       files.length === 0 && !isResolvingPaths ? ( <div className="text-center p-12 text-gray-500">{t('galleryNoFilesFound')}</div> ) : 
      (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
          {files.map((file) => {
            const fullFilePath = `${path}${path.endsWith('/') ? '' : '/'}${file.name}`;
            const isSelected = selectedFilePaths.includes(fullFilePath);
            return (
            <Card key={file.name} className={`overflow-hidden relative group transition-all duration-150 ${isSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'shadow-md hover:shadow-xl'}`}>
              <div className="absolute top-1.5 right-1.5 z-20">
                <Checkbox
                  id={`select-${file.name.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  checked={isSelected}
                  onCheckedChange={(checked) => {
                    setSelectedFilePaths(prev => checked ? [...prev, fullFilePath] : prev.filter(p => p !== fullFilePath));
                  }}
                  onClick={(e) => e.stopPropagation()} 
                  aria-label={`Select ${file.name}`}
                  className="bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-700 border-slate-400 dark:border-slate-500 h-5 w-5"
                />
              </div>
              <CardContent className="p-0">
                <div className="cursor-pointer" onClick={() => handleNavigate(file)} >
                  {file.is_dir ? ( <div className="h-32 sm:h-36 md:h-40 flex items-center justify-center bg-gray-100 dark:bg-slate-700 rounded-t-md"><FolderOpen className="h-12 w-12 text-yellow-500" /></div>) : 
                   isImageFile(file) ? ( <div className={`h-32 sm:h-36 md:h-40 bg-black flex items-center justify-center overflow-hidden rounded-t-md ${isSelected ? 'opacity-80' : ''}`}><img src={file.thumb || "/placeholder.svg"} alt={file.name} className="object-cover h-full w-full transition-transform duration-300 group-hover:scale-105" onError={(e) => { e.currentTarget.src = '/placeholder.svg';}}/></div>) : 
                   ( <div className="h-32 sm:h-36 md:h-40 flex items-center justify-center bg-gray-100 dark:bg-slate-700 rounded-t-md"><ImageIcon className="h-12 w-12 text-gray-400" /></div>)}
                </div>
                <div className="p-1.5 sm:p-2">
                  <p className="text-xs sm:text-sm font-medium truncate" title={file.name}>{file.name}</p>
                  <div className="flex flex-col mt-1 sm:mt-2 space-y-1 sm:space-y-2"> 
                    {!file.is_dir && isImageFile(file) && (
                      <>
                        <div className="flex justify-around items-center"> 
                          <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" title={t('galleryCopyDirectViewerLinkTooltip')} onClick={(e) => { e.stopPropagation(); handleCopyLink(file); }}><Link className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></Button>
                          {file.thumb && (<Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" title={t('galleryOpenThumbnailTooltip')} onClick={(e) => { e.stopPropagation(); if (file.thumb) window.open(file.thumb, '_blank'); else toast.error(t('galleryThumbnailUrlNotAvailable'));}}><ImageIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></Button> )}
                          <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-red-500 hover:text-red-700" title={t('galleryDeleteFileTooltip')} onClick={(e) => { e.stopPropagation(); handleDelete(file);}}><Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></Button>
                        </div>
                        <div className="flex space-x-1 justify-center"> 
                          <Button variant="outline" size="sm" className="h-7 px-1.5 sm:h-8 sm:px-2 text-xs" title={t('galleryCopyMarkdownTooltip')} onClick={(e) => { e.stopPropagation(); handleCopyMarkdownLink(file);}}>{t('mdButton')}</Button>
                          <Button variant="outline" size="sm" className="h-7 px-1.5 sm:h-8 sm:px-2 text-xs" title={t('galleryCopyHtmlTooltip')} onClick={(e) => { e.stopPropagation(); handleCopyHtmlLink(file);}}>{t('htmlButton')}</Button>
                          <Button variant="outline" size="sm" className="h-7 px-1.5 sm:h-8 sm:px-2 text-xs" title={t('galleryCopyUbbTooltip')} onClick={(e) => { e.stopPropagation(); handleCopyUbbLink(file);}}>{t('ubbButton')}</Button>
                        </div>
                       </>
                     )}
                     {file.is_dir && ( <Button variant="outline" size="icon" className="h-8 w-8 mx-auto" onClick={(e) => { e.stopPropagation(); handleDelete(file);}} title={t('galleryDeleteFolderTooltip', 'Delete this folder')}><Trash2 className="h-4 w-4 text-red-500" /></Button> )}
                   </div>
                 </div>
               </CardContent>
             </Card>
            );
          })}
        </div>
       )}

      <Dialog open={showEncryptShareDialog} onOpenChange={setShowEncryptShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t('galleryEncryptShareTitle')}</DialogTitle>
            <DialogDescription>
              {t('galleryEncryptShareDesc')}
              <br/><strong className="text-xs">{t('galleryEncryptShareWarning')}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4"><div className="grid flex-1 gap-2"><Label htmlFor="share-password" className="sr-only">{t('gallerySharePasswordLabel')}</Label><Input id="share-password" type="password" placeholder={t('gallerySharePasswordPlaceholder')} value={shareEncryptionPassword} onChange={(e) => setShareEncryptionPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleCreateEncryptedShareLink()}/></div></div>
          <DialogFooter className="sm:justify-start"><Button type="button" onClick={handleCreateEncryptedShareLink} disabled={!shareEncryptionPassword}><Lock className="mr-2 h-4 w-4" /> {t('galleryCreateLinkButton')}</Button><Button type="button" variant="ghost" onClick={() => setShowEncryptShareDialog(false)}>{t('galleryCancelButton')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMultiShareEncryptDialog} onOpenChange={setShowMultiShareEncryptDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('galleryMultiShareEncryptTitle')}</DialogTitle>
            <DialogDescription>
              {t('galleryMultiShareEncryptDesc')}
              <br/><strong className="text-xs">{t('galleryEncryptShareWarning')}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4"><div className="grid flex-1 gap-2"><Label htmlFor="multi-share-enc-password" className="sr-only">{t('gallerySharePasswordLabel')}</Label><Input id="multi-share-enc-password" type="password" placeholder={t('gallerySharePasswordPlaceholder')} value={multiShareEncryptionPassword} onChange={(e) => setMultiShareEncryptionPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleCreateEncryptedMultiShareLink()}/></div></div>
          <DialogFooter className="sm:justify-start"><Button type="button" onClick={handleCreateEncryptedMultiShareLink} disabled={!multiShareEncryptionPassword || imagePathsForGalleryShare.length === 0 || isResolvingPaths}><Lock className="mr-2 h-4 w-4" /> {t('galleryCreateLinkButton')}</Button><Button type="button" variant="ghost" onClick={() => setShowMultiShareEncryptDialog(false)}>{t('galleryCancelButton')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

       {files.filter(isImageFile).length > 0 && (
         <div className="mt-8">
           <h3 className="text-lg font-semibold mb-4">{t('galleryImageCarousel')}</h3>
           <Carousel className="w-full" plugins={[Autoplay({ delay: 10000, stopOnInteraction: true,})]} opts={{loop: true,}}>
             <CarouselContent>
               {files.filter(isImageFile).map((file) => (
                 <CarouselItem key={file.name} className="md:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                   <div className="p-1"><Card><CardContent className="flex aspect-square items-center justify-center p-2 sm:p-4 md:p-6">
                         <img src={file.thumb || "/placeholder.svg"} alt={file.name} className="object-contain h-full w-full rounded" onClick={() => handleViewImage(file)} style={{cursor: 'pointer'}} onError={(e) => {e.currentTarget.src = '/placeholder.svg';}}/>
                       </CardContent></Card></div>
                 </CarouselItem>
               ))}
             </CarouselContent>
             <CarouselPrevious className="ml-12 sm:ml-14 md:ml-16" />
             <CarouselNext className="mr-12 sm:mr-14 md:mr-16" />
           </Carousel>
         </div>
       )}
       {(currentFile && (currentImageUrl || isPreviewLoading)) && (
         <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4" onClick={() => { setCurrentFile(null); if (currentImageUrl && currentImageUrl.startsWith('blob:')) { URL.revokeObjectURL(currentImageUrl); } setCurrentImageUrl(null); setOriginalFileUrl(null); }}>
           <div className="relative bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 rounded-lg max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
             <div className="p-3 sm:p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
               <h3 className="font-medium text-sm sm:text-base truncate pr-2" title={currentFile?.name}>{currentFile?.name || t('galleryImagePreview')}</h3>
               <Button variant="ghost" size="sm" onClick={() => { setCurrentFile(null); if (currentImageUrl && currentImageUrl.startsWith('blob:')) { URL.revokeObjectURL(currentImageUrl); } setCurrentImageUrl(null); setOriginalFileUrl(null); }}>{t('galleryClose')}</Button>
             </div>
             <div className="p-2 sm:p-4 flex-grow flex items-center justify-center overflow-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
              {isPreviewLoading && (<Loader2 className="h-12 w-12 sm:h-16 sm:w-16 animate-spin text-gray-500 dark:text-gray-400" />)}
              {!isPreviewLoading && currentImageUrl && (
                <img src={currentImageUrl} alt={currentFile?.name || "Preview"} className={`${showFullImage ? 'cursor-zoom-out' : 'cursor-zoom-in object-contain'}`} style={{ display: isPreviewLoading ? 'none' : 'block', maxWidth: showFullImage ? 'none' : '100%', maxHeight: showFullImage ? 'none' : 'calc(90vh - 120px - 4rem)', width: 'auto', height: 'auto' }} onClick={() => setShowFullImage(!showFullImage)} onError={(e) => { e.currentTarget.src = '/placeholder.svg'; toast.error(t('galleryErrorLoadingPreview'));}}/>
              )}
              {!isPreviewLoading && !currentImageUrl && currentFile && (
                 <div className="text-center text-red-500 dark:text-red-400 p-4"><p>{t('galleryErrorLoadingPreview')}</p>{originalFileUrl && (<a href={originalFileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 underline">{t('galleryTryOpeningDirectly')}</a>)}</div>
              )}
             </div>
             <div className="p-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
               <Button onClick={() => currentFile && handleOpenEncryptShareDialog(currentFile)} size="sm">
                 <Share2 className="mr-1.5 h-4 w-4" /> {t('copyPreviewLinkButton')} 
               </Button>
                <Button onClick={() => setShowFullImage(!showFullImage)} disabled={!currentImageUrl || isPreviewLoading} size="sm">
                  {showFullImage ? t('zoomOutButton') : t('zoomInButton')}
                </Button>
             </div>
           </div>
         </div>
       )}

     <Dialog open={showManualCopyDialog} onOpenChange={setShowManualCopyDialog}>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle>{t('galleryManualCopyTitle', 'Manual Copy Required')}</DialogTitle>
           <DialogDescription>
             {t('galleryManualCopyDescription', 'Automatic copy failed or is unreliable. Please manually copy the link below.')}
           </DialogDescription>
         </DialogHeader>
         <div className="my-4">
           <Input
             type="text"
             readOnly
             value={manualCopyLink || ""}
             className="w-full"
             onFocus={(e) => e.target.select()}
           />
         </div>
         <DialogFooter className="gap-2 sm:justify-end">
           <Button variant="outline" onClick={() => setShowManualCopyDialog(false)}>{t('galleryCloseButton', 'Close')}</Button>
           <Button onClick={() => {
             if (manualCopyLink) {
               navigator.clipboard.writeText(manualCopyLink)
                 .then(() => {
                   toast.success(t('galleryLinkCopiedToClipboard', 'Link copied to clipboard!'));
                   setShowManualCopyDialog(false);
                 })
                 .catch(() => toast.error(t('galleryManualCopyFailedAgain', 'Copy to clipboard failed again.')));
             }
           }}>{t('galleryCopyToClipboardButton', 'Copy to Clipboard')}</Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>

    </div>
 );
};

export default Gallery;
