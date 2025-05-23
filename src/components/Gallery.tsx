import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { AlistService, FileInfo, AuthDetails, ListResponse } from "@/services/alistService";
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
  LibraryBig,
  ZoomIn,
  ZoomOut
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
import pako from 'pako';

interface AlistConfigToShare {
  serverUrl: string | null;
  authDetails: AuthDetails | null;
  r2CustomDomain?: string;
  imagePaths?: string[];
  galleryTitle?: string; // Added for custom gallery title
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
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const itemsPerPage = 30; // Or make this configurable
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalFileUrl, setOriginalFileUrl] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<FileInfo | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);

  // Zoom Modal States from ImageViewer
  const [isZoomModalOpen, setIsZoomModalOpen] = useState<boolean>(false);
  const [zoomedImageSrc, setZoomedImageSrc] = useState<string | null>(null);
  const [zoomedImageAlt, setZoomedImageAlt] = useState<string>("");
  const [zoomLevel, setZoomLevel] = useState<number>(1);

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
  const [customGalleryTitle, setCustomGalleryTitle] = useState<string>("");

  const isImageFile = useCallback((file: FileInfo) => !file.is_dir && file.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|avif|jxl)$/i), []);

  const displayedFiles = useMemo(() => files.filter(file => file.is_dir || isImageFile(file)), [files, isImageFile]);
  
  const allDisplayedItemPaths = useMemo(() => displayedFiles.map(f => `${path}${path.endsWith('/') ? '' : '/'}${f.name}`), [displayedFiles, path]);
  const isAllSelected = useMemo(() => displayedFiles.length > 0 && selectedFilePaths.length === displayedFiles.length, [selectedFilePaths, displayedFiles.length]);

  // Zoom Modal Functions from ImageViewer
  const openZoomModal = (src: string | null, alt: string) => {
    if (src) {
      setZoomedImageSrc(src);
      setZoomedImageAlt(alt);
      setZoomLevel(1); // Reset zoom level when opening new image
      setIsZoomModalOpen(true);
    }
  };
  
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev * 1.2, 5)); // Max zoom 5x
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev / 1.2, 0.2)); // Min zoom 0.2x

  const loadFiles = useCallback(async (currentPathToLoad?: string, dirPassword?: string, pageToLoad: number = 1) => {
    if (!alistService) {
      setFiles([]);
      setLoading(false);
      setLoadingMore(false);
      return;
    }
    const pathToLoad = currentPathToLoad || path;
    if (pageToLoad === 1) {
      setLoading(true);
      setFiles([]); // Reset files when loading the first page or changing path
    } else {
      setLoadingMore(true);
    }
    setPasswordError(null);
    try {
      const passwordToUse = dirPassword || directoryPasswords[pathToLoad];
      const response: ListResponse = await alistService.listFiles(pathToLoad, passwordToUse, pageToLoad, itemsPerPage);
      
      setFiles(prevFiles => pageToLoad === 1 ? response.content : [...prevFiles, ...response.content]);
      setCurrentPage(pageToLoad);
      setTotalPages(Math.ceil(response.total / itemsPerPage));

      if (passwordToUse && pathToLoad === passwordPromptPath) {
        setShowPasswordDialog(false);
        setCurrentPasswordInput("");
      }
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
        if (pageToLoad === 1) setFiles([]); // Ensure files are cleared on error for the first page
      } else {
        toast.error(`${t('galleryErrorLoadingFiles')} ${errorMessage}`);
        if (pageToLoad === 1) setFiles([]); // Ensure files are cleared on error for the first page
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [alistService, path, t, directoryPasswords, passwordPromptPath, itemsPerPage, setFiles, setCurrentPage, setTotalPages, setLoading, setLoadingMore, setPasswordError, setShowPasswordDialog, setCurrentPasswordInput]);
  
  useEffect(() => {
    setSelectedFilePaths([]);
    setCurrentPage(1);
    setTotalPages(1);
    if (alistService) {
      loadFiles(path, directoryPasswords[path], 1);
    } else {
      setFiles([]); 
      setLoading(false); 
    }
    return () => {
      if (currentImageUrl && currentImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentImageUrl);
      }
    };
  }, [alistService, path, loadFiles, directoryPasswords]);

  const handlePasswordSubmit = () => {
    if (!passwordPromptPath || !currentPasswordInput) return;
    setDirectoryPasswords(prev => ({ ...prev, [passwordPromptPath]: currentPasswordInput }));
    loadFiles(passwordPromptPath, currentPasswordInput, 1);
  };

  const handleNavigate = (file: FileInfo) => {
    if (file.is_dir) { onPathChange(`${path}${path.endsWith('/') ? '' : '/'}${file.name}`); }
    else {
      // Instead of old handleViewImage, prepare for zoom modal
      if (!alistService) return;
      setIsPreviewLoading(true); // Keep this for immediate feedback if needed, or remove if zoom modal handles its own loading state
      setCurrentFile(file); // Keep for context if needed by zoom modal title or other actions
      
      const alistFilePath = `${path}${path.endsWith('/') ? '' : '/'}${file.name}`;
      alistService.getFileLink(alistFilePath).then(directUrl => {
        setOriginalFileUrl(directUrl); // Store original URL if needed for download or other actions
        
        // Fetch as blob to ensure correct display and potentially for zoom modal if it expects blob URLs
        fetch(directUrl)
          .then(response => {
            if (!response.ok) {
              console.warn(`Failed to fetch image as blob (${response.status} ${response.statusText}), using direct URL for zoom: ${directUrl}`);
              openZoomModal(directUrl, file.name); // Open zoom modal with direct URL
              return null; // Or throw error
            }
            return response.blob();
          })
          .then(blob => {
            if (blob) {
              let typedBlob = blob;
              const fileExtension = file.name.split('.').pop()?.toLowerCase();
              const correctMimeType = getMimeType(fileExtension);
              if (!blob.type.startsWith('image/') && correctMimeType) {
                try { typedBlob = new Blob([blob], { type: correctMimeType }); }
                catch (blobError) { console.error("Error creating typed blob:", blobError); }
              }
              const blobUrl = URL.createObjectURL(typedBlob);
              // Revoke previous blob URL if it exists and is a blob URL
              if (currentImageUrl && currentImageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(currentImageUrl);
              }
              setCurrentImageUrl(blobUrl); // Store for potential revocation or other uses
              openZoomModal(blobUrl, file.name); // Open zoom modal with blob URL
            }
          })
          .catch(fetchError => {
            console.warn(`Error fetching image for blob: ${fetchError.message}. Using direct URL for zoom: ${directUrl}`);
            openZoomModal(directUrl, file.name); // Fallback to direct URL
          })
          .finally(() => {
            setIsPreviewLoading(false);
          });
      }).catch(error => {
        toast.error(`${t('galleryErrorGettingImageLink')} ${error.message || t('galleryUnknownError')}`);
        setIsPreviewLoading(false);
      });
    }
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

  // const handleViewImage = async (file: FileInfo) => { // This function is replaced by the logic in handleNavigate for non-dirs
  //   if (!alistService) return;
  //   setIsPreviewLoading(true); setCurrentFile(file);
  //   if (currentImageUrl && currentImageUrl.startsWith('blob:')) { URL.revokeObjectURL(currentImageUrl); }
  //   setCurrentImageUrl(null); setOriginalFileUrl(null);
  //   try {
  //     const alistFilePath = `${path}${path.endsWith('/') ? '' : '/'}${file.name}`;
  //     const directUrl = await alistService.getFileLink(alistFilePath);
  //     setOriginalFileUrl(directUrl);
  //     try {
  //       const response = await fetch(directUrl);
  //       if (!response.ok) { console.warn(`Failed to fetch image as blob (${response.status} ${response.statusText}), falling back to direct URL for: ${directUrl}`); setCurrentImageUrl(directUrl); }
  //       else {
  //         const blob = await response.blob(); let typedBlob = blob;
  //         const fileExtension = file.name.split('.').pop()?.toLowerCase();
  //         const correctMimeType = getMimeType(fileExtension);
  //         if (!blob.type.startsWith('image/') && correctMimeType) { try { typedBlob = new Blob([blob], { type: correctMimeType }); } catch (blobError) { console.error("Error creating typed blob:", blobError); }}
  //         const blobUrl = URL.createObjectURL(typedBlob); setCurrentImageUrl(blobUrl);
  //       }
  //     } catch (fetchError: any) { console.warn(`Error fetching image for blob: ${fetchError.message}. Falling back to direct URL: ${directUrl}`); setCurrentImageUrl(directUrl); }
  //   } catch (error: any) { toast.error(`${t('galleryErrorGettingImageLink')} ${error.message || t('galleryUnknownError')}`); }
  //   finally { setIsPreviewLoading(false); }
  // };
  
  const handleOpenEncryptShareDialog = (file: FileInfo) => {
    const enablePasswordless = localStorage.getItem("alist_enable_passwordless_share") === "true";
    const defaultPassword = localStorage.getItem("alist_default_share_password");

    setFileToShare(file); // Set the file to share regardless

    if (enablePasswordless && defaultPassword) {
      setShareEncryptionPassword(defaultPassword);
      // Use a microtask to ensure state is set before calling
      Promise.resolve().then(() => {
        handleCreateEncryptedShareLink(file, defaultPassword); // Pass file and password directly
      });
    } else {
      setShareEncryptionPassword("");
      setShowEncryptShareDialog(true);
    }
  };

  // Modified to accept file and password as parameters
  const handleCreateEncryptedShareLink = async (fileForShare: FileInfo | null, passwordToUse?: string) => {
    if (!alistService) { toast.error(t('galleryErrorAlistServiceMissing', 'Alist service is not available.')); return; }
    
    const currentFileToProcess = fileForShare || fileToShare; // Prioritize passed file
    const finalPassword = passwordToUse || shareEncryptionPassword;

    if (!currentFileToProcess || !finalPassword) {
      toast.error(t('galleryErrorPasswordForEncryption'));
      // If it was an auto-call (fileForShare and passwordToUse were provided) and failed here, log it.
      if (fileForShare && passwordToUse) { // Check if it was an auto-call attempt
        console.warn("Auto-create single file share link failed due to missing file or password just before encryption. File was:", fileForShare ? fileForShare.name : 'null', "Password was:", passwordToUse ? '***' : 'undefined');
      }
      return;
    }
    const serverUrl = alistService.getBaseUrl();
    const token = alistService.getCurrentToken();
    const r2CustomDomain = alistService.getR2CustomDomain();
    if (!serverUrl) { toast.error(t('galleryErrorAlistConfigMissingForShare', 'Alist server URL is not configured (from service).')); return; }
    let authDetailsToEncrypt: AuthDetails | null = token ? { token } : (alistService.getIsPublicClient() ? null : null);
    const configToEncrypt: AlistConfigToShare = { serverUrl, authDetails: authDetailsToEncrypt, r2CustomDomain };
    try {
      const encryptedConfig = placeholderEncrypt(JSON.stringify(configToEncrypt), finalPassword); // Use finalPassword
      if (!encryptedConfig) { toast.error(t('galleryErrorEncryptionFailed')); return; }
      const alistFilePath = `${path}${path.endsWith('/') ? '' : '/'}${currentFileToProcess.name}`; // Use currentFileToProcess
      let viewerLink = `${window.location.origin}/view?path=${encodeURIComponent(alistFilePath)}&c=${encodeURIComponent(encryptedConfig)}`;
      
      const enablePasswordlessGlobal = localStorage.getItem("alist_enable_passwordless_share") === "true";
      const defaultPasswordFromStorage = localStorage.getItem("alist_default_share_password");

      // Check if passwordless mode is active AND the password used for encryption IS the default one
      if (enablePasswordlessGlobal && defaultPasswordFromStorage && finalPassword === defaultPasswordFromStorage) {
        try {
          const encodedPassword = btoa(finalPassword); // Use finalPassword
          viewerLink += `&pm=1&pk=${encodeURIComponent(encodedPassword)}`;
          // toast.info("Passwordless share link generated for single file."); // Avoid double toast if auto-called
        } catch (e) {
          console.error("Error base64 encoding password for single file passwordless link:", e);
        }
      }
      
      viewerLink = await alistService.getShortUrl(viewerLink); // Attempt to get short URL
      navigator.clipboard.writeText(viewerLink)
        .then(() => {
          toast.success(t('galleryEncryptedLinkCopied') + (isMobile ? " " + t('galleryMobileCopyPrompt', 'Please try pasting. If it fails, you may need to copy it manually.') : ""));
          const isPasswordlessDefaultShareSingle = enablePasswordlessGlobal && defaultPasswordFromStorage && finalPassword === defaultPasswordFromStorage;
          if (finalPassword && !isPasswordlessDefaultShareSingle) {
            toast.info(t('gallerySharePasswordReminder'));
          }
          setManualCopyLink(viewerLink);
          setShowManualCopyDialog(true);
        })
        .catch(err => {
          console.error('Failed to copy encrypted link: ', err);
          toast.error(t('galleryErrorCopyingLinkGeneric', 'Failed to copy link. You may need to do it manually.'));
          setManualCopyLink(viewerLink); 
          setShowManualCopyDialog(true);
        });
      setShowEncryptShareDialog(false); setFileToShare(null);
    } catch (e:any) { console.error("Err creating encrypted link:", e); toast.error(`${t('galleryErrorCreatingEncryptedLink')} ${e.message}`); }
  };

  const resolvePathsForGalleryShare = async (selectedPaths: string[]): Promise<string[]> => {
    if (!alistService) return [];
    setIsResolvingPaths(true);
    toast.info(t('galleryResolvingFolderPaths', 'Resolving folder contents for gallery...'));
    console.log('[Gallery] resolvePathsForGalleryShare - Input selectedPaths:', JSON.stringify(selectedPaths));
    const resolvedImagePaths: string[] = [];
    for (const selectedPath of selectedPaths) {
      const fileEntry = files.find(f => `${path}${path.endsWith('/') ? '' : '/'}${f.name}` === selectedPath);
      console.log(`[Gallery] resolvePathsForGalleryShare - Processing selectedPath: "${selectedPath}", found fileEntry:`, fileEntry ? {name: fileEntry.name, is_dir: fileEntry.is_dir} : null);
      if (fileEntry) {
        if (fileEntry.is_dir) {
          try {
            const passwordForDir = directoryPasswords[selectedPath];
            console.log(`[Gallery] resolvePathsForGalleryShare - Listing folder: "${selectedPath}" with password: ${passwordForDir ? '***' : 'none'}`);
            const dirResponse = await alistService.listFiles(selectedPath, passwordForDir);
            console.log(`[Gallery] resolvePathsForGalleryShare - Content of folder "${selectedPath}":`, dirResponse.content.map(f => ({name: f.name, is_dir: f.is_dir, type: f.type, thumb: !!f.thumb})));
            dirResponse.content.filter(isImageFile).forEach(imgFile => {
              const fullImgPath = `${selectedPath}${selectedPath.endsWith('/') ? '' : '/'}${imgFile.name}`;
              resolvedImagePaths.push(fullImgPath);
              console.log(`[Gallery] resolvePathsForGalleryShare - Added image from folder: "${fullImgPath}"`);
            });
          } catch (e) { console.error(`Error listing contents of folder ${selectedPath}:`, e); toast.error(t('galleryErrorListingFolderContents', { folderName: fileEntry.name })); }
        } else if (isImageFile(fileEntry)) {
          resolvedImagePaths.push(selectedPath);
          console.log(`[Gallery] resolvePathsForGalleryShare - Added direct image file: "${selectedPath}"`);
        }
      } else {
        console.warn(`[Gallery] resolvePathsForGalleryShare - Could not find fileEntry for selectedPath: "${selectedPath}" in current files list.`);
      }
    }
    setIsResolvingPaths(false);
    if (resolvedImagePaths.length === 0 && selectedPaths.length > 0) { toast.warning(t('galleryNoImagesFoundInSelection')); }
    console.log('[Gallery] resolvePathsForGalleryShare - Output resolvedImagePaths:', JSON.stringify(resolvedImagePaths));
    return [...new Set(resolvedImagePaths)];
  };

  const handleOpenMultiShareDialog = async () => {
    console.log('[Gallery] handleOpenMultiShareDialog - Entry. Current selectedFilePaths:', JSON.stringify(selectedFilePaths));
    if (selectedFilePaths.length === 0) {
      toast.info(t('galleryNoFilesSelectedForMultiShare'));
      console.log('[Gallery] handleOpenMultiShareDialog - Exiting: No files selected.');
      return;
    }
    console.log('[Gallery] handleOpenMultiShareDialog - About to call resolvePathsForGalleryShare with:', JSON.stringify(selectedFilePaths));
    const resolvedPaths = await resolvePathsForGalleryShare(selectedFilePaths);
    console.log('[Gallery] handleOpenMultiShareDialog - resolvedPaths received:', JSON.stringify(resolvedPaths));
    if (resolvedPaths.length === 0 && selectedFilePaths.length > 0) {
      console.log('[Gallery] handleOpenMultiShareDialog - Exiting: Resolved paths is empty, but original selection was not.');
      return;
    } // No images found after resolving folders
    if (resolvedPaths.length === 0) {
      toast.info(t('galleryNoImagesToShareAfterResolution', 'No images to share after resolving selection.'));
      console.log('[Gallery] handleOpenMultiShareDialog - Exiting: Resolved paths is empty.');
      return;
    }
    
    // Set state for dialog use
    setImagePathsForGalleryShare(resolvedPaths);
    setCustomGalleryTitle(""); // Reset custom title

    const enablePasswordless = localStorage.getItem("alist_enable_passwordless_share") === "true";
    const defaultPassword = localStorage.getItem("alist_default_share_password");

    if (enablePasswordless && defaultPassword) {
      setMultiShareEncryptionPassword(defaultPassword); // Pre-fill with default password if passwordless is enabled
    } else {
      setMultiShareEncryptionPassword(""); // Clear password if manual input is required
    }
    setShowMultiShareEncryptDialog(true); // Always show the dialog
  };
  
  const handleCreateEncryptedMultiShareLink = async (
    pathsToUseOverride?: string[],
    passwordToUseOverride?: string
  ) => {
    if (!alistService) { toast.error(t('galleryErrorAlistServiceMissing', 'Alist service is not available.')); return; }
    
    const finalPaths = pathsToUseOverride || imagePathsForGalleryShare;
    const finalPassword = passwordToUseOverride || multiShareEncryptionPassword;

    if (finalPaths.length === 0 || !finalPassword) {
      toast.error(t('galleryErrorPasswordOrFilesForMultiShare'));
      // If called automatically and failed this check, ensure dialog doesn't pop up unexpectedly
      // if it was meant to be an auto-call. However, this function is also called by dialog button.
      // If pathsToUseOverride was provided, it was an auto-call.
      if (pathsToUseOverride) {
        console.warn("Auto-create multi-share link failed due to missing paths or password just before encryption.");
      }
      return;
    }
    
    const serverUrl = alistService.getBaseUrl();
    const token = alistService.getCurrentToken();
    const r2CustomDomain = alistService.getR2CustomDomain();
    if (!serverUrl) { toast.error(t('galleryErrorAlistConfigMissingForShare', 'Alist server URL is not configured (from service).')); return; }
    let authDetailsToEncrypt: AuthDetails | null = token ? { token } : (alistService.getIsPublicClient() ? null : null);
    const configToEncrypt: AlistConfigToShare & { v?: number; comp?: string } = {
      serverUrl,
      authDetails: authDetailsToEncrypt,
      r2CustomDomain,
      imagePaths: finalPaths, // Use the correctly resolved paths passed as argument
      galleryTitle: customGalleryTitle.trim() || undefined, // Add custom title
      v: 2,
      comp: 'pako_b64'
    };
    try {
      const jsonString = JSON.stringify(configToEncrypt);
      const compressedData = pako.deflate(jsonString); 
      let binaryString = '';
      const chunkSize = 8192;
      for (let i = 0; i < compressedData.length; i += chunkSize) {
        binaryString += String.fromCharCode.apply(null, Array.from(compressedData.subarray(i, i + chunkSize)));
      }
      const base64Compressed = btoa(binaryString);

      const encryptedConfig = placeholderEncrypt(base64Compressed, finalPassword); // Use finalPassword
      if (!encryptedConfig) { toast.error(t('galleryErrorEncryptionFailed')); return; }
      let viewerLink = `${window.location.origin}/view?type=gallery&c=${encodeURIComponent(encryptedConfig)}`;

      const enablePasswordless = localStorage.getItem("alist_enable_passwordless_share") === "true";
      const defaultPasswordFromStorage = localStorage.getItem("alist_default_share_password");

      // Check if passwordless mode is active AND the password used for encryption IS the default one
      if (enablePasswordless && defaultPasswordFromStorage && finalPassword === defaultPasswordFromStorage) {
        try {
          const encodedPassword = btoa(finalPassword); // Use finalPassword
          viewerLink += `&pm=1&pk=${encodeURIComponent(encodedPassword)}`;
          // toast.info("Passwordless gallery share link generated."); // Already shown if auto
        } catch (e) {
          console.error("Error base64 encoding password for gallery passwordless link:", e);
        }
      }
      
      viewerLink = await alistService.getShortUrl(viewerLink); // Attempt to get short URL
      navigator.clipboard.writeText(viewerLink)
        .then(() => {
          toast.success(t('galleryMultiEncryptedLinkCopied') + (isMobile ? " " + t('galleryMobileCopyPrompt', 'Please try pasting. If it fails, you may need to copy it manually.') : ""));
          const isPasswordlessDefaultShareMulti = enablePasswordless && defaultPasswordFromStorage && finalPassword === defaultPasswordFromStorage;
          if (finalPassword && !isPasswordlessDefaultShareMulti) {
            toast.info(t('gallerySharePasswordReminder'));
          }
          setManualCopyLink(viewerLink);
          setShowManualCopyDialog(true);
        })
        .catch(err => {
          console.error('Failed to copy multi-share encrypted link: ', err);
          toast.error(t('galleryErrorCopyingLinkGeneric', 'Failed to copy link. You may need to do it manually.'));
          setManualCopyLink(viewerLink); 
          setShowManualCopyDialog(true);
        });
      setShowMultiShareEncryptDialog(false); setSelectedFilePaths([]); setImagePathsForGalleryShare([]); setCustomGalleryTitle("");
    } catch (e:any) { console.error("Err creating multi-share link:", e); toast.error(`${t('galleryErrorCreatingEncryptedLink')} ${e.message}`);}
  };

  const generateViewerLink = (filePath: string) => `${window.location.origin}/view?path=${encodeURIComponent(filePath)}`;
  
  const copyHelper = async (contentToCopy: string, successMsgKey: string, errorMsgKey: string = 'galleryErrorCopyingLinkGeneric', isRawLink: boolean = false) => {
    if (!alistService) {
      toast.error(t('galleryErrorAlistServiceMissing', 'Alist service is not available.'));
      setManualCopyLink(contentToCopy); 
      setShowManualCopyDialog(true);
      return;
    }

    let finalLink = contentToCopy;
    if (!isRawLink) { 
      finalLink = await alistService.getShortUrl(contentToCopy);
    }

    navigator.clipboard.writeText(finalLink)
      .then(() => {
        toast.success(t(successMsgKey) + (isMobile ? " " + t('galleryMobileCopyPrompt', 'Please try pasting. If it fails, you may need to copy it manually.') : ""));
        setManualCopyLink(finalLink);
        setShowManualCopyDialog(true);
      })
      .catch(err => {
        console.error(`Failed to copy (${successMsgKey}): `, err);
        toast.error(t(errorMsgKey, 'Failed to copy link. You may need to do it manually.'));
        setManualCopyLink(finalLink); 
        setShowManualCopyDialog(true);
      });
  };

  const handleCopyLink = async (file: FileInfo) => {
    const alistFilePath = `${path}${path.endsWith('/') ? '' : '/'}${file.name}`;
    const viewerLink = generateViewerLink(alistFilePath);
    if (viewerLink) await copyHelper(viewerLink, 'imageLinkCopied');
    else toast.error(t('galleryErrorCopyingLink'));
  };

  const handleCopyMarkdownLink = async (file: FileInfo) => {
    if (!alistService) { toast.error(t('galleryErrorAlistServiceMissing')); return; }
    const alistFilePath = `${path}${path.endsWith('/') ? '' : '/'}${file.name}`;
    try {
      const directUrl = await alistService.getFileLink(alistFilePath);
      if (directUrl) {
        await copyHelper(`![${file.name}](${directUrl})`, 'markdownLinkCopied', 'galleryErrorCopyingMarkdownLink', true);
      } else {
        toast.error(t('galleryErrorGettingDirectLink'));
      }
    } catch (error: any) {
      toast.error(`${t('galleryErrorGettingDirectLink')} ${error.message || ''}`);
    }
  };

  const handleCopyHtmlLink = async (file: FileInfo) => {
    if (!alistService) { toast.error(t('galleryErrorAlistServiceMissing')); return; }
    const alistFilePath = `${path}${path.endsWith('/') ? '' : '/'}${file.name}`;
    try {
      const directUrl = await alistService.getFileLink(alistFilePath);
      if (directUrl) {
        await copyHelper(`<img src="${directUrl}" alt="${file.name}">`, 'htmlLinkCopied', 'galleryErrorCopyingHtmlLink', true);
      } else {
        toast.error(t('galleryErrorGettingDirectLink'));
      }
    } catch (error: any) {
      toast.error(`${t('galleryErrorGettingDirectLink')} ${error.message || ''}`);
    }
  };

  const handleCopyUbbLink = async (file: FileInfo) => {
    if (!alistService) { toast.error(t('galleryErrorAlistServiceMissing')); return; }
    const alistFilePath = `${path}${path.endsWith('/') ? '' : '/'}${file.name}`;
    try {
      const directUrl = await alistService.getFileLink(alistFilePath);
      if (directUrl) {
        await copyHelper(`[img]${directUrl}[/img]`, 'ubbLinkCopied', 'galleryErrorCopyingUbbLink', true);
      } else {
        toast.error(t('galleryErrorGettingDirectLink'));
      }
    } catch (error: any) {
      toast.error(`${t('galleryErrorGettingDirectLink')} ${error.message || ''}`);
    }
  };

  const handleCopyThumbnailLink = async (file: FileInfo) => {
    if (!file.thumb) { toast.error(t('galleryThumbnailUrlNotAvailable')); return; }
    // Thumbnails are direct URLs, do not attempt to shorten them.
    await copyHelper(file.thumb, 'thumbnailLinkCopied', 'galleryErrorCopyingThumbnailLink', true);
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
      loadFiles(path, directoryPasswords[path], 1); // Reload from page 1
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
    finally {
      loadFiles(path, directoryPasswords[path], 1);
      setSelectedFilePaths([]);
    }
  };

  const navigateUp = () => {
    if (path === "/") return;
    const newPath = path.split("/").slice(0, -1).join("/") || "/";
    onPathChange(newPath);
  };

  const handleLoadMore = () => {
    if (currentPage < totalPages && !loadingMore && alistService) {
      loadFiles(path, directoryPasswords[path], currentPage + 1);
    }
  };

  const handleLoadAllImages = async () => {
    if (!alistService || loading || loadingMore || isResolvingPaths) return;

    setLoading(true);
    setLoadingMore(true); 
    setFiles([]); 
    setSelectedFilePaths([]); 

    try {
      const passwordToUse = directoryPasswords[path];
      const response: ListResponse = await alistService.listFiles(path, passwordToUse, 1, 10000); 
      
      const allItems = response.content.filter(file => file.is_dir || isImageFile(file));
      setFiles(allItems);
      setCurrentPage(1); 
      setTotalPages(1); 
      toast.success(t('galleryAllImagesLoaded', { count: allItems.length }));

    } catch (error: any) {
      const errorMessage = error.message || t('galleryUnknownError');
      toast.error(`${t('galleryErrorLoadingAllFiles')} ${errorMessage}`);
      setFiles([]); 
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
 
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
           {displayedFiles.length > 0 && (
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
          <Button variant="outline" size="sm" onClick={() => loadFiles(path, undefined, 1)}>{t('galleryRefresh')}</Button>
          {currentPage < totalPages && ( 
            <Button variant="outline" size="sm" onClick={handleLoadAllImages} disabled={loading || loadingMore || isResolvingPaths}>
              {loadingMore ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {t('galleryLoadAllImages', 'Load All Images')} ({files.length} / {totalPages * itemsPerPage}) 
            </Button>
          )}
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
       displayedFiles.length === 0 && !isResolvingPaths ? ( <div className="text-center p-12 text-gray-500">{t('galleryNoFilesFound')}</div> ) :
      (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
          {displayedFiles.map((file) => { 
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
      
      {loadingMore && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        </div>
      )}

      {!loading && !loadingMore && currentPage < totalPages && displayedFiles.length > 0 && (
        <div className="flex justify-center py-4">
          <Button onClick={handleLoadMore} variant="outline">
            {t('galleryLoadMore', 'Load More')}
          </Button>
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
          <div className="flex items-center space-x-2 py-4"><div className="grid flex-1 gap-2"><Label htmlFor="share-password" className="sr-only">{t('gallerySharePasswordLabel')}</Label><Input id="share-password" type="password" placeholder={t('gallerySharePasswordPlaceholder')} value={shareEncryptionPassword} onChange={(e) => setShareEncryptionPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleCreateEncryptedShareLink(fileToShare, shareEncryptionPassword)}/></div></div>
          <DialogFooter className="sm:justify-start"><Button type="button" onClick={() => handleCreateEncryptedShareLink(fileToShare, shareEncryptionPassword)} disabled={!shareEncryptionPassword || !fileToShare}><Lock className="mr-2 h-4 w-4" /> {t('galleryCreateLinkButton')}</Button><Button type="button" variant="ghost" onClick={() => setShowEncryptShareDialog(false)}>{t('galleryCancelButton')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMultiShareEncryptDialog} onOpenChange={setShowMultiShareEncryptDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('galleryMultiShareEncryptTitle')}</DialogTitle>
            <DialogDescription>
              {!(localStorage.getItem("alist_enable_passwordless_share") === "true" && localStorage.getItem("alist_default_share_password")) ? (
                <>
                  {t('galleryMultiShareEncryptDesc')}
                  <br/><strong className="text-xs">{t('galleryEncryptShareWarning')}</strong>
                </>
              ) : (
                t('galleryMultiShareEncryptDescPasswordless', 'Enter a title for your gallery (optional). The link will be secured with the default password.')
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="gallery-title-input" className="text-left">{t('galleryCustomTitleLabel', 'Gallery Title (Optional)')}</Label>
              <Input
                id="gallery-title-input"
                placeholder={t('galleryCustomTitlePlaceholder', 'Enter custom gallery title')}
                value={customGalleryTitle}
                onChange={(e) => setCustomGalleryTitle(e.target.value)}
              />
            </div>
            {!(localStorage.getItem("alist_enable_passwordless_share") === "true" && localStorage.getItem("alist_default_share_password")) && (
              <div className="grid flex-1 gap-2">
                <Label htmlFor="multi-share-enc-password">{t('gallerySharePasswordLabel', 'Password')}</Label>
                <Input
                  id="multi-share-enc-password"
                  type="password"
                  placeholder={t('gallerySharePasswordPlaceholder', 'Enter password for sharing')}
                  value={multiShareEncryptionPassword}
                  onChange={(e) => setMultiShareEncryptionPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateEncryptedMultiShareLink()}
                />
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              onClick={() => handleCreateEncryptedMultiShareLink()}
              disabled={
                // Disable if password input is shown AND password is empty OR no images OR resolving paths
                (!(localStorage.getItem("alist_enable_passwordless_share") === "true" && localStorage.getItem("alist_default_share_password")) && !multiShareEncryptionPassword) ||
                imagePathsForGalleryShare.length === 0 ||
                isResolvingPaths
              }
            >
              <Lock className="mr-2 h-4 w-4" /> {t('galleryCreateLinkButton')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowMultiShareEncryptDialog(false)}>{t('galleryCancelButton')}</Button>
          </DialogFooter>
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
                         <img src={file.thumb || "/placeholder.svg"} alt={file.name} className="object-contain h-full w-full rounded" onClick={() => handleNavigate(file)} style={{cursor: 'pointer'}} onError={(e) => {e.currentTarget.src = '/placeholder.svg';}}/>
                       </CardContent></Card></div>
                 </CarouselItem>
               ))}
             </CarouselContent>
             <CarouselPrevious className="ml-12 sm:ml-14 md:ml-16" />
             <CarouselNext className="mr-12 sm:mr-14 md:ml-16" />
           </Carousel>
         </div>
       )}
     {/* Removed old preview modal. New Zoom Modal from ImageViewer will be used. */}

     {/* Zoom Modal - Copied and adapted from ImageViewer.tsx */}
     <Dialog open={isZoomModalOpen} onOpenChange={setIsZoomModalOpen}>
       <DialogContent className="max-w-[90vw] max-h-[90vh] w-auto h-auto p-2 sm:p-4 flex flex-col bg-white dark:bg-black !rounded-lg">
         <DialogHeader className="flex flex-row justify-between items-center py-3">
           <DialogTitle className="truncate max-w-[calc(100%-130px)] text-sm sm:text-base">{zoomedImageAlt}</DialogTitle>
           <div className="flex items-center space-x-1.5 flex-shrink-0">
               <Button variant="ghost" size="icon" onClick={handleZoomOut} title={t('imageViewer.zoomOut', "Zoom Out")}><ZoomOut className="h-5 w-5"/></Button>
               <Button variant="ghost" size="icon" onClick={handleZoomIn} title={t('imageViewer.zoomIn', "Zoom In")}><ZoomIn className="h-5 w-5"/></Button>
               {/* The default X button from DialogContent will be to the right of this div */}
           </div>
         </DialogHeader>
         <div className={`w-full flex-grow relative overflow-auto pt-2 ${zoomLevel <= 1 ? 'flex items-center justify-center' : ''} dark:bg-black`}>
           {zoomedImageSrc && (
             <img
               src={zoomedImageSrc}
               alt={zoomedImageAlt}
               className={`transition-transform duration-200 ease-out ${zoomLevel <= 1 ? 'max-w-full max-h-full object-contain' : 'cursor-grab active:cursor-grabbing'}`}
               style={{
                 transform: `scale(${zoomLevel})`,
                 transformOrigin: zoomLevel <= 1 ? 'center center' : '0 0',
                 display: 'block'
               }}
               onError={(e) => {
                 e.currentTarget.src = '/placeholder.svg';
                 toast.error(t('galleryErrorLoadingPreview', 'Error loading image preview.'));
                 // Optionally close modal or show error message within modal
                 // setIsZoomModalOpen(false);
               }}
             />
           )}
         </div>
          {/* Optional: Footer for actions like download, share from zoom modal */}
          <DialogFooter className="p-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between sm:justify-between">
             <Button
               onClick={() => {
                 if (currentFile) handleOpenEncryptShareDialog(currentFile);
                 else if (zoomedImageAlt) { // Fallback if currentFile is not set, try to find by alt
                   const fileByName = files.find(f => f.name === zoomedImageAlt);
                   if (fileByName) handleOpenEncryptShareDialog(fileByName);
                   else toast.error(t('galleryCannotShareFromZoom', 'Cannot determine file to share.'));
                 }
               }}
               size="sm"
               disabled={!currentFile && !files.find(f => f.name === zoomedImageAlt)}
             >
                <Share2 className="mr-1.5 h-4 w-4" /> {t('copyPreviewLinkButton', 'Share Link')}
             </Button>
             {originalFileUrl && (
               <Button asChild size="sm" variant="outline">
                 <a href={originalFileUrl} download={zoomedImageAlt || 'image'} target="_blank" rel="noopener noreferrer">
                   {t('galleryDownloadOriginal', 'Download Original')}
                 </a>
               </Button>
             )}
           </DialogFooter>
       </DialogContent>
     </Dialog>

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
