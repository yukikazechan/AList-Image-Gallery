import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AlistService, AuthDetails } from '@/services/alistService';
import { Loader2, AlertCircle, ChevronLeft, ZoomIn, ZoomOut } from 'lucide-react'; // Removed CloseIcon from here
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';
import { placeholderDecrypt } from '@/lib/placeholderCrypto';
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

const ImageViewer: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  
  const mode = searchParams.get('type') === 'gallery' ? 'gallery' : 'single';
  const singleImagePathFromParam = searchParams.get('path'); 
  const encryptedConfigParam = searchParams.get('c');

  const [singleImageUrl, setSingleImageUrl] = useState<string | null>(null);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  
  const [error, setError] = useState<string | null>(null); 
  const [isLoading, setIsLoading] = useState<boolean>(true); 

  const [showPasswordPrompt, setShowPasswordPrompt] = useState<boolean>(!!encryptedConfigParam);
  const [decryptionPassword, setDecryptionPassword] = useState<string>('');
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  const [tempAlistConfig, setTempAlistConfig] = useState<DecryptedConfig | null>(null);
  const [triedDecryption, setTriedDecryption] = useState<boolean>(false);
  const [decryptedImagePaths, setDecryptedImagePaths] = useState<string[] | null>(null);

  // State for Zoom Modal
  const [isZoomModalOpen, setIsZoomModalOpen] = useState<boolean>(false);
  const [zoomedImageSrc, setZoomedImageSrc] = useState<string | null>(null);
  const [zoomedImageAlt, setZoomedImageAlt] = useState<string>("");
  // State for zoom level within modal
  const [zoomLevel, setZoomLevel] = useState<number>(1);


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


  const handlePasswordSubmit = useCallback(() => {
    if (!encryptedConfigParam) return;
    setDecryptionError(null);
    setIsLoading(true); 
    try {
      const decryptedJson = placeholderDecrypt(encryptedConfigParam, decryptionPassword);
      const config = JSON.parse(decryptedJson) as DecryptedConfig;
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
      setTriedDecryption(true);
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

  useEffect(() => {
    const objectUrlsToRevoke: string[] = [];

    const fetchAndSetImage = async (filePath: string, index?: number) => {
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
         if (!blob.type.startsWith('image/')) {
            console.warn(`[ImageViewer] Fetched content for ${filePath} is not an image. Type: ${blob.type}. Displaying anyway.`);
        }
        const objectUrl = URL.createObjectURL(blob);
        objectUrlsToRevoke.push(objectUrl);

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
    };
    
    const currentImagePathForEffect = mode === 'single' ? singleImagePathFromParam : null;
    const currentImagePathsForEffect = mode === 'gallery' ? (decryptedImagePaths || (searchParams.get('paths') ? JSON.parse(searchParams.get('paths') || '[]') : [])) : null;


    if (encryptedConfigParam && showPasswordPrompt && !triedDecryption) {
      setIsLoading(false); return;
    }
    if (encryptedConfigParam && triedDecryption && !tempAlistConfig && !localStorageAlistConfig.serverUrl) {
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
          setIsLoading(true); 
          setGalleryItems(pathsToLoad.map(p => ({ path: p, src: null, isLoading: true, error: undefined, originalUrl: undefined })));
          Promise.allSettled(pathsToLoad.map((p, idx) => fetchAndSetImage(p, idx)))
            .then(() => setIsLoading(false)); 
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
      objectUrlsToRevoke.forEach(url => {
        if (url) {
          console.log(`[ImageViewer] Revoking object URL: ${url}`);
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [
    mode, singleImagePathFromParam, alistService, t, 
    showPasswordPrompt, triedDecryption, encryptedConfigParam, 
    localStorageAlistConfig.serverUrl, tempAlistConfig, 
    decryptedImagePaths, searchParams // Added searchParams as it's used for 'paths'
  ]);


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
        <div className="w-full flex flex-col items-center">
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
          <h2 className="text-2xl font-semibold mb-4 text-center">{t('imageViewer.galleryTitle', 'Image Gallery')} ({galleryItems.filter(item => item.src && !item.error).length}/{galleryItems.length})</h2>
          {error && <p className="text-red-500 text-center mb-4">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {galleryItems.map((item) => (
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
        </div>
      )}
      {mode === 'gallery' && galleryItems.filter(item => !item.isLoading).length === 0 && !isLoading && !error && ( // Adjusted condition
         <div className="w-full text-center"><p>{t('imageViewer.galleryNoImagesLoaded', 'No images loaded for gallery view.')}</p></div>
      )}

      {/* Zoom Modal */}
      <Dialog open={isZoomModalOpen} onOpenChange={setIsZoomModalOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] w-auto h-auto p-2 sm:p-4 flex flex-col bg-white dark:bg-slate-900 !rounded-lg">
          <DialogHeader className="flex flex-row justify-between items-center pb-2">
            <DialogTitle className="truncate max-w-[calc(100%-80px)] text-sm sm:text-base">{zoomedImageAlt}</DialogTitle> {/* Adjusted max-width */}
            <div className="flex items-center space-x-1">
                <Button variant="ghost" size="icon" onClick={handleZoomOut} title={t('imageViewer.zoomOut', "Zoom Out")}><ZoomOut className="h-5 w-5"/></Button>
                <Button variant="ghost" size="icon" onClick={handleZoomIn} title={t('imageViewer.zoomIn', "Zoom In")}><ZoomIn className="h-5 w-5"/></Button>
                {/* Rely on default DialogContent close button or Dialog.Close if needed elsewhere. Removed explicit one here. */}
            </div>
          </DialogHeader>
          <div className="flex-grow flex items-center justify-center overflow-auto relative pt-2"> {/* Added pt-2 for a bit of space from header */}
            {zoomedImageSrc && (
              <img 
                src={zoomedImageSrc} 
                alt={zoomedImageAlt} 
                className="max-w-full max-h-full object-contain transition-transform duration-200 ease-out"
                style={{ transform: `scale(${zoomLevel})` }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageViewer;