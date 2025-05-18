import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AlistService, AuthDetails } from '@/services/alistService';
import { Loader2, AlertCircle, ChevronLeft, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from 'react-i18next';
import { placeholderDecrypt } from '@/lib/placeholderCrypto';
import pako from 'pako';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  // DialogClose is often part of DialogContent by default or used as a trigger
} from "@/components/ui/dialog";
import { ThemeToggleButton } from '@/components/ThemeToggleButton'; // Import ThemeToggleButton

interface DecryptedConfig {
  serverUrl: string;
  authDetails: AuthDetails | null;
  r2CustomDomain?: string;
  imagePaths?: string[]; 
}

interface GalleryItem {
  path: string;
  src: string | null;
  error?: string;
  isLoading: boolean;
  originalUrl?: string; 
}

// Moved getMimeTypeByFilename outside the component for stable reference
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
    default: return undefined;
  }
};

const ImageViewer: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  // Helper function to decrypt and parse payload, attempting decompression
  const decryptAndParsePayload = (encryptedPayload: string, passwordForDecryption: string): DecryptedConfig & { comp?: string; v?: number } => {
    const decryptedBasePayload = placeholderDecrypt(encryptedPayload, passwordForDecryption);
    try {
      // Attempt Base64 decode then pako inflate (for new v2 links with comp marker)
      const binaryDecoded = atob(decryptedBasePayload);
      const uint8Array = new Uint8Array(binaryDecoded.length);
      for (let i = 0; i < binaryDecoded.length; i++) {
        uint8Array[i] = binaryDecoded.charCodeAt(i);
      }
      const decompressedJson = pako.inflate(uint8Array, { to: 'string' });
      console.log("[ImageViewer] Decompressed shared config successfully.");
      const parsedConfig = JSON.parse(decompressedJson);
      // Check if it was indeed a compressed payload we expected
      if (parsedConfig.comp === 'pako_b64' && parsedConfig.v === 2) {
        return parsedConfig as DecryptedConfig & { comp?: string; v?: number };
      }
      // If markers don't match, but it decompressed and parsed, it's an odd state.
      // For safety, if it doesn't look like our compressed format, try parsing original decrypted payload.
      // This path might be hit if an uncompressed payload coincidentally base64 decodes and inflates to valid JSON.
      console.warn("[ImageViewer] Payload decompressed but markers didn't match. Attempting direct parse of original decrypted payload.");
      return JSON.parse(decryptedBasePayload) as DecryptedConfig & { comp?: string; v?: number };
    } catch (e) {
      console.log("[ImageViewer] Failed to decompress/decode as pako_b64, assuming raw JSON payload (v1 link or error).", e);
      // Fallback: assume it's raw (non-compressed, non-base64) JSON
      return JSON.parse(decryptedBasePayload) as DecryptedConfig & { comp?: string; v?: number };
    }
  };
  
  const mode = searchParams.get('type') === 'gallery' ? 'gallery' : 'single';
  const singleImagePathFromParam = searchParams.get('path'); 
  const encryptedConfigParam = searchParams.get('c');

  const [singleImageUrl, setSingleImageUrl] = useState<string | null>(null);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  
  const [error, setError] = useState<string | null>(null); 
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false); // For "Load More" button
  const [numDisplayed, setNumDisplayed] = useState<number>(25); // Initial number of items to display
  const ITEMS_PER_LOAD = 25; // Number of items to load each time

  const [showPasswordPrompt, setShowPasswordPrompt] = useState<boolean>(false); // Initial state false, will be set by useEffect
  const [decryptionPassword, setDecryptionPassword] = useState<string>('');
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  const [tempAlistConfig, setTempAlistConfig] = useState<DecryptedConfig | null>(null);
  const [triedDecryption, setTriedDecryption] = useState<boolean>(false); // Tracks if manual decryption attempt was made
  const [decryptedImagePaths, setDecryptedImagePaths] = useState<string[] | null>(null);
  const [initialPasswordLoadAttempted, setInitialPasswordLoadAttempted] = useState<boolean>(false);

  // State for Zoom Modal
  const [isZoomModalOpen, setIsZoomModalOpen] = useState<boolean>(false);
  const [zoomedImageSrc, setZoomedImageSrc] = useState<string | null>(null);
  const [zoomedImageAlt, setZoomedImageAlt] = useState<string>("");
  // State for zoom level within modal
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Pagination state removed


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

  // Pagination logic removed

  const handlePasswordSubmit = useCallback(() => {
    if (!encryptedConfigParam) return;
    setDecryptionError(null);
    setIsLoading(true);
    try {
      // Directly pass encrypted payload and password to the helper
      const config = decryptAndParsePayload(encryptedConfigParam, decryptionPassword);
      if (!config.serverUrl) {
        throw new Error(t('imageViewer.decryptionFailedConfigError', 'Decrypted data is not a valid Alist configuration.'));
      }
      setTempAlistConfig(config);
      if (mode === 'gallery' && config.imagePaths && Array.isArray(config.imagePaths)) {
        setDecryptedImagePaths(config.imagePaths);
      } else if (mode === 'gallery' && (!config.imagePaths || !Array.isArray(config.imagePaths))) {
        console.warn("[ImageViewer] Gallery mode specified, but no imagePaths array in decrypted config.");
        throw new Error(t('imageViewer.galleryModeNoPathsError', 'Gallery mode selected, but image paths are missing in the shared link.'));
      }
      setShowPasswordPrompt(false);
      setTriedDecryption(true); // Mark that a successful decryption (manual or auto) has occurred

      // Save the successfully used password to localStorage
      if (encryptedConfigParam && decryptionPassword) {
        try {
          const savedPasswords = JSON.parse(localStorage.getItem('sharedLinkPasswords_v1') || '{}');
          savedPasswords[encryptedConfigParam] = decryptionPassword;
          localStorage.setItem('sharedLinkPasswords_v1', JSON.stringify(savedPasswords));
          console.log("[ImageViewer] Share password saved to localStorage.");
        } catch (lsError) {
          console.error("Failed to save share password to localStorage", lsError);
        }
      }
    } catch (e: any) {
      console.error("Decryption error:", e);
      setDecryptionError(e.message || t('imageViewer.decryptionGenericError', 'Failed to decrypt configuration.'));
      setTempAlistConfig(null); 
      setDecryptedImagePaths(null);
      setIsLoading(false); 
    }
  }, [encryptedConfigParam, decryptionPassword, t, mode]);

  const localStorageAlistConfig = useMemo(() => {
    const serverUrl = localStorage.getItem("alist_server_url");
    const token = localStorage.getItem("alist_token");
    const username = localStorage.getItem("alist_username");
    const password = localStorage.getItem("alist_password");
    const r2CustomDomain = localStorage.getItem("alist_r2_custom_domain") || undefined;
    let authDetails: AuthDetails | null = null;
    if (token) authDetails = { token };
    else if (username) authDetails = { username, password: password || "" };
    return { serverUrl, authDetails, r2CustomDomain };
  }, []);

  const activeAlistConfig = useMemo(() => {
    if (tempAlistConfig) return tempAlistConfig; 
    return localStorageAlistConfig; 
  }, [tempAlistConfig, localStorageAlistConfig]);

  const alistService = useMemo(() => {
    if (activeAlistConfig.serverUrl) { 
      try {
        return new AlistService(activeAlistConfig.authDetails, activeAlistConfig.serverUrl, activeAlistConfig.r2CustomDomain);
      } catch (e) {
        console.error("Failed to initialize AlistService in ImageViewer:", e);
        if (!encryptedConfigParam || triedDecryption) {
          setError(t('imageViewer.alistServiceInitError', 'Failed to initialize Alist connection.'));
        }
        return null;
      }
    }
    return null;
  }, [activeAlistConfig, encryptedConfigParam, triedDecryption, t]);

  // Effect for attempting to load and decrypt with saved password
  useEffect(() => {
    if (encryptedConfigParam && !initialPasswordLoadAttempted && !tempAlistConfig) {
      setInitialPasswordLoadAttempted(true); // Mark that we are attempting now
      try {
        const savedPasswords = JSON.parse(localStorage.getItem('sharedLinkPasswords_v1') || '{}');
        const savedPwd = savedPasswords[encryptedConfigParam];

        if (savedPwd) {
          console.log("[ImageViewer] Found saved password, attempting auto-decryption...");
          // Directly pass encrypted payload and saved password to the helper
          const config = decryptAndParsePayload(encryptedConfigParam, savedPwd);

          if (config.serverUrl) {
            setTempAlistConfig(config);
            if (mode === 'gallery' && config.imagePaths && Array.isArray(config.imagePaths)) {
              setDecryptedImagePaths(config.imagePaths);
            }
            setDecryptionPassword(savedPwd); // Pre-fill for consistency, though not strictly needed if prompt is bypassed
            setShowPasswordPrompt(false);    // Bypass prompt
            setTriedDecryption(true);       // Mark as successfully decrypted (via auto)
            console.log("[ImageViewer] Auto-decryption successful with saved password.");
            // Data loading will be triggered by the main useEffect due to tempAlistConfig change
            return;
          } else {
            throw new Error("Invalid config structure from saved password during auto-decryption.");
          }
        }
      } catch (e) {
        console.warn("[ImageViewer] Auto-decryption with saved password failed:", e);
        try {
          const savedPasswords = JSON.parse(localStorage.getItem('sharedLinkPasswords_v1') || '{}');
          delete savedPasswords[encryptedConfigParam];
          localStorage.setItem('sharedLinkPasswords_v1', JSON.stringify(savedPasswords));
          console.log("[ImageViewer] Cleared bad/failed saved password for this link.");
        } catch (lsError) { console.error("Error clearing bad password from localStorage", lsError); }
      }
      // If no saved password, or auto-decryption failed, ensure prompt is shown if it's an encrypted link and we don't have a config yet
      if (encryptedConfigParam && !tempAlistConfig) {
          setShowPasswordPrompt(true);
      }
    } else if (!encryptedConfigParam && !initialPasswordLoadAttempted) {
      // For non-encrypted links, ensure prompt is not shown and mark check as done
      setShowPasswordPrompt(false);
      setInitialPasswordLoadAttempted(true);
    }
  }, [encryptedConfigParam, initialPasswordLoadAttempted, tempAlistConfig, mode, t]); // placeholderDecrypt is a pure function, not a reactive dependency

  const objectUrlsToRevokeRef = useRef<string[]>([]);

  const fetchAndSetImage = useCallback(async (filePath: string, index?: number) => {
    if (index !== undefined) {
      setGalleryItems(prev => prev.map((item, i) => i === index ? { ...item, isLoading: true, error: undefined } : item));
    } else {
      setIsLoading(true); // For single image mode
      setError(null);
    }

    try {
      if (!alistService) throw new Error(t('imageViewer.noAlistServiceErrorShort', 'Alist service not ready.'));
      
      const originalFileUrl = await alistService.getFileLink(filePath);
      if (!originalFileUrl) throw new Error(t('imageViewer.failedToGetDirectUrlError', 'Failed to get direct URL.'));

      const response = await fetch(originalFileUrl);
      if (!response.ok) throw new Error(`${t('imageViewer.fetchFailedError', 'Fetch failed:')} ${response.status} ${response.statusText}`);
      
      const blob = await response.blob();
      let typedBlob = blob;
      const determinedMimeType = getMimeTypeByFilename(filePath);

      if (determinedMimeType && (!blob.type || !blob.type.startsWith('image/'))) {
        try {
          typedBlob = new Blob([blob], { type: determinedMimeType });
          console.log(`[ImageViewer] Corrected blob type for ${filePath} from ${blob.type || 'unknown'} to ${determinedMimeType}`);
        } catch (blobError) {
          console.error(`[ImageViewer] Error creating typed blob for ${filePath} with type ${determinedMimeType}:`, blobError);
          // typedBlob remains the original blob in case of error
        }
      } else if (!blob.type || !blob.type.startsWith('image/')) {
          console.warn(`[ImageViewer] Fetched content for ${filePath} (type: ${blob.type || 'unknown'}) is not an image and specific type not determined from extension. Displaying as is.`);
      }
      
      const objectUrl = URL.createObjectURL(typedBlob);
      objectUrlsToRevokeRef.current.push(objectUrl);

      if (index !== undefined) {
        setGalleryItems(prev => prev.map((item, i) => i === index ? { path: filePath, src: objectUrl, isLoading: false, originalUrl: originalFileUrl } : item));
      } else {
        setSingleImageUrl(objectUrl);
      }
    } catch (err: any) {
      console.error(`[ImageViewer] Error fetching image for path ${filePath}:`, err);
      if (index !== undefined) {
        setGalleryItems(prev => prev.map((item, i) => i === index ? { ...item, isLoading: false, error: err.message, src: null, originalUrl: item.originalUrl } : item));
      } else {
        setError(`${t('imageViewer.loadImageError', 'Error loading image:')} ${err.message}`);
        setSingleImageUrl(null);
      }
    } finally {
      if (index === undefined) setIsLoading(false); // For single image mode
    }
  }, [alistService, t, setGalleryItems, setIsLoading, setError, setSingleImageUrl]);

  useEffect(() => {
    const currentImagePathForEffect = mode === 'single' ? singleImagePathFromParam : null;
    const currentImagePathsForEffect = mode === 'gallery' ? (decryptedImagePaths || (searchParams.get('paths') ? JSON.parse(searchParams.get('paths') || '[]') : [])) : null;

    // Wait for initial password check/auto-decrypt attempt before proceeding if encrypted
    if (encryptedConfigParam && !initialPasswordLoadAttempted) {
      setIsLoading(true); // Show loading while waiting for password check effect
      return;
    }
    
    // If encrypted, prompt is shown, and we haven't successfully set tempAlistConfig (manual or auto)
    if (encryptedConfigParam && showPasswordPrompt && !tempAlistConfig) {
      setIsLoading(false); // Not loading data, waiting for password
      return;
    }
    // If encrypted, but decryption failed and no fallback
    if (encryptedConfigParam && initialPasswordLoadAttempted && !tempAlistConfig && !localStorageAlistConfig.serverUrl) {
      setError(t('imageViewer.decryptionFailedNoFallback', 'Decryption failed and no local configuration available.'));
      setIsLoading(false); return;
    }
    if (!alistService && !showPasswordPrompt) {
        setError(t('imageViewer.noAlistServiceError', 'Alist service not available. Please configure Alist connection or provide valid encrypted config.'));
        setIsLoading(false); return;
    }
    
    if (alistService && (!showPasswordPrompt || triedDecryption)) {
      if (mode === 'gallery') {
        let pathsToLoad: string[] | null = null;
        if (encryptedConfigParam && tempAlistConfig?.imagePaths) {
          pathsToLoad = tempAlistConfig.imagePaths;
        } else if (!encryptedConfigParam) { 
          const pathsParam = searchParams.get('paths');
          try {
            if (pathsParam) pathsToLoad = JSON.parse(pathsParam);
          } catch (e) { console.error("Failed to parse 'paths' URL param:", e); setError(t('imageViewer.invalidPathsParam', "Invalid 'paths' parameter in URL for gallery.")); }
        }

        if (pathsToLoad && pathsToLoad.length > 0) {
          // Initialize galleryItems with all paths, but src and isLoading set to false initially
          setGalleryItems(pathsToLoad.map(p => ({ path: p, src: null, isLoading: false, error: undefined, originalUrl: undefined })));
          // setIsLoading(true) will be handled by the new useEffect for page-specific loading
          // The actual fetching will be triggered by the new useEffect hook based on currentPage and itemsPerPage
        } else if (!encryptedConfigParam || (triedDecryption && tempAlistConfig && !tempAlistConfig.imagePaths)) {
          setError(t('imageViewer.galleryNoImages', 'No images specified for gallery view.'));
          setIsLoading(false);
        }
      } else if (mode === 'single' && currentImagePathForEffect) {
        fetchAndSetImage(currentImagePathForEffect);
      } else if (mode === 'single' && !currentImagePathForEffect) {
         setError(t('imageViewer.noPathError', 'Image path not provided.'));
         setIsLoading(false);
      }
    }

    return () => {
      objectUrlsToRevokeRef.current.forEach(url => {
        if (url) {
          console.log(`[ImageViewer] Revoking object URL: ${url}`);
          URL.revokeObjectURL(url);
        }
      });
      // Clear the ref for next full load if component unmounts and remounts.
      // Or, if this effect re-runs due to its dependencies changing in a way that implies a "reset".
      // For now, let's clear it on unmount.
      // objectUrlsToRevokeRef.current = []; // This might be too aggressive if other effects also use it.
      // Let's only revoke. If the component unmounts and remounts, the ref will be fresh.
    };
  }, [
    mode, singleImagePathFromParam, alistService, t,
    showPasswordPrompt, triedDecryption, encryptedConfigParam,
    localStorageAlistConfig.serverUrl, tempAlistConfig,
    decryptedImagePaths, searchParams, fetchAndSetImage // Added fetchAndSetImage
  ]);

  // useEffect for loading gallery images up to numDisplayed
  useEffect(() => {
    if (mode !== 'gallery' || !alistService || galleryItems.length === 0 || (encryptedConfigParam && showPasswordPrompt && !triedDecryption)) {
      setIsLoading(false); // Ensure loading is false if conditions not met for gallery loading
      return;
    }

    const itemsToPotentiallyLoad = galleryItems.slice(0, numDisplayed);
    let currentlyFetchingCount = 0;

    itemsToPotentiallyLoad.forEach((item, index) => {
      // Ensure we are checking the actual item in the full galleryItems array at this index
      if (galleryItems[index] && !galleryItems[index].src && !galleryItems[index].error && !galleryItems[index].isLoading) {
        fetchAndSetImage(galleryItems[index].path, index);
        currentlyFetchingCount++;
      } else if (galleryItems[index] && galleryItems[index].isLoading) {
        currentlyFetchingCount++;
      }
    });

    setIsLoadingMore(currentlyFetchingCount > 0);
    // Set global isLoading: true if any of the *currently displayed or about to be displayed* items are loading.
    // False if all *currently displayed* items are settled.
    if (currentlyFetchingCount > 0) {
      setIsLoading(true);
    } else {
      // Check if all items *up to numDisplayed* are settled (have src or error)
      const allCurrentlyDisplayedSettled = galleryItems.slice(0, numDisplayed).every(it => it.src || it.error);
      if (allCurrentlyDisplayedSettled) {
        setIsLoading(false);
      }
      // If not all settled but nothing is fetching, it implies initial state or error state for some,
      // global isLoading might remain true from initial page load until first batch settles.
      // The fetchAndSetImage also manipulates isLoading for single items.
    }

  }, [numDisplayed, galleryItems, alistService, mode, showPasswordPrompt, triedDecryption, encryptedConfigParam, fetchAndSetImage]);


  const handleLoadMore = () => {
    if (isLoadingMore || numDisplayed >= galleryItems.length) return;
    setNumDisplayed(prev => Math.min(prev + ITEMS_PER_LOAD, galleryItems.length));
  };


  if (showPasswordPrompt && encryptedConfigParam) {
    return ( /* Password Prompt JSX ... */
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h1 className="text-2xl font-bold mb-4">{t('imageViewer.passwordPromptTitle', 'Password Required')}</h1>
        <p className="mb-2">{t('imageViewer.passwordPromptMessage', 'This link is password protected. Please enter the password to view the image.')}</p>
        <Input type="password" value={decryptionPassword} onChange={(e) => setDecryptionPassword(e.target.value)} placeholder={t('imageViewer.passwordPlaceholder', 'Enter password')} className="mb-2 max-w-xs" onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}/>
        {decryptionError && <p className="text-red-500 text-sm mb-2">{decryptionError}</p>}
        <Button onClick={handlePasswordSubmit} disabled={isLoading || !decryptionPassword}>
          {isLoading && showPasswordPrompt ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('imageViewer.submitPasswordButton', 'Submit')}
        </Button>
         <Button variant="link" size="sm" className="mt-4" onClick={() => { setShowPasswordPrompt(false); setTriedDecryption(true); setTempAlistConfig(null); setDecryptedImagePaths(null); }}>
            {t('imageViewer.cancelPasswordButton', 'Cancel / Try public access')}
          </Button>
      </div>
    );
  }

  if (!activeAlistConfig.serverUrl && (!encryptedConfigParam || (triedDecryption && !tempAlistConfig))) {
     return ( /* Config Missing JSX ... */
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h1 className="text-2xl font-bold mb-4">{t('imageViewer.configMissingTitle', 'Alist Configuration Missing')}</h1>
        <p className="mb-4">{t('imageViewer.configMissingMessage', 'Alist server details not found. Please configure on main page or use a link with embedded config.')}</p>
        <Button asChild><Link to="/">{t('imageViewer.goToSettingsButton', 'Go to Settings')}</Link></Button>
      </div>
    );
  }

  if (isLoading && (mode === 'single' || galleryItems.length === 0 || galleryItems.some(item => item.isLoading))) {
    return (<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-16 w-16 animate-spin" /></div>);
  }
  
  if (error && (!singleImageUrl && galleryItems.filter(item => item.src && !item.error).length === 0)) {
    return ( /* Error Display JSX ... */
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-semibold mb-2">{t('imageViewer.errorOccurred', 'An Error Occurred')}</h1>
        <p className="text-red-600 mb-4">{error}</p>
        <Button asChild><Link to="/">{t('imageViewer.backToHomeButton', 'Back to Home')}</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start min-h-screen bg-gray-100 dark:bg-slate-900 p-4">
      <div className="w-full mb-4 flex justify-between items-center">
        <Button variant="outline" asChild size="sm">
           <Link to="/"><ChevronLeft className="mr-1 h-4 w-4" />{t('imageViewer.backToGalleryButton', 'Back to Main')}</Link>
        </Button>
        <ThemeToggleButton /> {/* Added ThemeToggleButton */}
      </div>

      {mode === 'single' && singleImageUrl && !error && (
        <div className="w-full flex flex-col items-center dark:bg-black"> {/* Added dark:bg-black */}
          <img
            src={singleImageUrl}
            alt={singleImagePathFromParam || t('imageViewer.viewedImageAlt', 'Viewed Image')} 
            className="max-w-full max-h-[85vh] object-contain rounded shadow-lg cursor-zoom-in"
            onClick={() => openZoomModal(singleImageUrl, singleImagePathFromParam || 'Image')}
          />
        </div>
      )}
      {mode === 'single' && !singleImageUrl && !isLoading && !error && (
         <div className="w-full text-center"><p>{t('imageViewer.noImagePreview', 'No image to preview, path may be invalid, or access denied.')}</p></div>
      )}

      {mode === 'gallery' && galleryItems.length > 0 && (
        <div className="w-full">
          <h2 className="text-2xl font-semibold mb-4 text-center">{t('imageViewer.galleryTitle', 'Image Gallery')} ({galleryItems.length})</h2>
          {error && <p className="text-red-500 text-center mb-4">{error}</p>}

          {/* Pagination UI removed */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {galleryItems.slice(0, numDisplayed).map((item) => (
              <div key={item.path} className="border rounded-lg overflow-hidden shadow-lg dark:bg-slate-800 aspect-square flex flex-col">
                <div className="flex-grow flex items-center justify-center overflow-hidden bg-gray-200 dark:bg-slate-700">
                  {item.isLoading && !item.src && (<Loader2 className="h-8 w-8 animate-spin" />)}
                  {item.error && (
                    <div className="p-2 text-center">
                      <AlertCircle className="w-8 h-8 text-red-500 mb-1 mx-auto" />
                      <p className="text-xs text-red-700 dark:text-red-400">{item.error}</p>
                      {item.originalUrl && <Button variant="link" size="sm" className="mt-1 text-xs h-auto p-0" asChild><a href={item.originalUrl} target="_blank" rel="noopener noreferrer">{t('imageViewer.tryOpenDirectly', 'Try Direct Link')}</a></Button>}
                    </div>
                  )}
                  {item.src && !item.error && (
                    <img src={item.src} alt={item.path} className="w-full h-full object-cover cursor-zoom-in" onClick={() => openZoomModal(item.src, item.path)} />
                  )}
                </div>
                <p className="text-xs p-2 truncate dark:text-slate-300 bg-white dark:bg-slate-800 border-t dark:border-slate-700" title={item.path}>{item.path.substring(item.path.lastIndexOf('/') + 1)}</p>
              </div>
            ))}
          </div>
          {mode === 'gallery' && galleryItems.length > 0 && (
            <div className="w-full flex flex-col sm:flex-row justify-center items-center mt-8 mb-4 gap-4">
              {numDisplayed < galleryItems.length && (
                <Button onClick={handleLoadMore} disabled={isLoadingMore || isLoading}>
                  {(isLoadingMore || (isLoading && galleryItems.slice(0, numDisplayed).some(i => i.isLoading && !i.src && !i.error))) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('imageViewer.loadMoreButton', 'Load More')} ({galleryItems.length - numDisplayed} {t('imageViewer.remaining', 'remaining')})
                </Button>
              )}
              {numDisplayed < galleryItems.length && (
                 <Button onClick={() => setNumDisplayed(galleryItems.length)} disabled={isLoadingMore || isLoading} variant="outline">
                   {t('galleryLoadAllImages', 'Load All Images')} ({galleryItems.length})
                 </Button>
              )}
            </div>
          )}
        </div>
      )}
      {mode === 'gallery' && galleryItems.length > 0 && galleryItems.slice(0, numDisplayed).filter(item => !item.isLoading && !item.src && !item.error).length === numDisplayed && !isLoading && !error && (
         <div className="w-full text-center mt-4"><p>{t('imageViewer.galleryAllAttemptedNoSuccess', 'Attempted to load images, but none could be displayed. Check paths or permissions.')}</p></div>
      )}
      {mode === 'gallery' && galleryItems.length === 0 && !isLoading && !error && (
         <div className="w-full text-center"><p>{t('imageViewer.galleryNoImagesLoaded', 'No images loaded for gallery view.')}</p></div>
      )}

      {/* Zoom Modal */}
      <Dialog open={isZoomModalOpen} onOpenChange={setIsZoomModalOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] w-auto h-auto p-2 sm:p-4 flex flex-col bg-white dark:bg-slate-900 !rounded-lg">
          <DialogHeader className="flex flex-row justify-between items-center py-3"> {/* Increased vertical padding */}
            <DialogTitle className="truncate max-w-[calc(100%-130px)] text-sm sm:text-base">{zoomedImageAlt}</DialogTitle> {/* Reserved more space for buttons */}
            <div className="flex items-center space-x-1.5 flex-shrink-0"> {/* Added flex-shrink-0 and slightly increased spacing */}
                <Button variant="ghost" size="icon" onClick={handleZoomOut} title={t('imageViewer.zoomOut', "Zoom Out")}><ZoomOut className="h-5 w-5"/></Button>
                <Button variant="ghost" size="icon" onClick={handleZoomIn} title={t('imageViewer.zoomIn', "Zoom In")}><ZoomIn className="h-5 w-5"/></Button>
                {/* The default X button from DialogContent will be to the right of this div */}
            </div>
          </DialogHeader>
          <div className={`w-full flex-grow relative overflow-auto pt-2 ${zoomLevel <= 1 ? 'flex items-center justify-center' : ''} dark:bg-black`}> {/* Conditionally apply flex centering */}
            {zoomedImageSrc && (
              <img
                src={zoomedImageSrc}
                alt={zoomedImageAlt}
                className={`transition-transform duration-200 ease-out ${zoomLevel <= 1 ? 'max-w-full max-h-full object-contain' : 'cursor-grab active:cursor-grabbing'}`} // Restore conditional classes
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: zoomLevel <= 1 ? 'center center' : '0 0', // Change origin when zoomed in
                  display: 'block'
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageViewer;