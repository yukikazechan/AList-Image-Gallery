
import React, { useState, useEffect, useCallback, useRef } from "react"; // Added useRef
import { AlistService, FileInfo } from "@/services/alistService";
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
import {
  ChevronLeft,
  FolderOpen,
  Image as ImageIcon,
  Link,
  Trash2,
  Loader2,
  KeyRound
} from "lucide-react";
import { toast } from "sonner";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay"; // Import Autoplay plugin
import ReactPlayer from 'react-player'; // Import ReactPlayer
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface GalleryProps {
  alistService: AlistService | null;
  path: string;
  onPathChange: (path: string) => void;
  directoryPasswords: Record<string, string>; // Add directoryPasswords prop
  setDirectoryPasswords: React.Dispatch<React.SetStateAction<Record<string, string>>>; // Add setDirectoryPasswords prop
}

const Gallery: React.FC<GalleryProps> = ({ alistService, path, onPathChange, directoryPasswords, setDirectoryPasswords }) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null); // This will hold the blob URL for preview
  const [originalFileUrl, setOriginalFileUrl] = useState<string | null>(null); // This will hold the direct URL from AList
  const [currentFile, setCurrentFile] = useState<FileInfo | null>(null);
  const [showFullImage, setShowFullImage] = useState<boolean>(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);

  const [showPasswordDialog, setShowPasswordDialog] = useState<boolean>(false);
  const [passwordPromptPath, setPasswordPromptPath] = useState<string>("");
  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string | null>(null);


  const loadFiles = useCallback(async (currentPath?: string, dirPassword?: string) => {
    if (!alistService) {
      console.log("loadFiles: alistService is null, returning.");
      setFiles([]); // Clear files if service is not available
      setLoading(false);
      return;
    }
    const pathToLoad = currentPath || path;
    setLoading(true);
    setPasswordError(null); // Reset password error on new load attempt

    try {
      const passwordToUse = dirPassword || directoryPasswords[pathToLoad];
      console.log(`loadFiles: Loading files for path: ${pathToLoad}, using password: ${passwordToUse ? 'yes' : 'no'}`); // Log password usage
      const filesList = await alistService.listFiles(pathToLoad, passwordToUse);
      const filteredFiles = filesList.filter(file =>
        file.is_dir || file.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|avif)$/i)
      );
      setFiles(filteredFiles);
      if (passwordToUse && pathToLoad === passwordPromptPath) { // If password was used successfully for prompted path
        setShowPasswordDialog(false); // Close dialog if open
        setCurrentPasswordInput(""); // Clear input
      }
    } catch (error: any) {
      console.error("loadFiles error:", error); // Log the full error
      const errorMessage = error.message || t('galleryUnknownError');
      const lowerErrorMessage = errorMessage.toLowerCase();

      // Keywords indicating a password-related issue
      const isPasswordError =
        lowerErrorMessage.includes("password") &&
        (lowerErrorMessage.includes("incorrect") ||
         lowerErrorMessage.includes("permission") ||
         lowerErrorMessage.includes("required") ||
         lowerErrorMessage.includes("denied") ||
         lowerErrorMessage.includes("unauthorized")); // Added unauthorized

      // Specific AList messages that often relate to password issues even without the word "password"
      const isObjectNotFoundError =
        lowerErrorMessage.includes("object not found") ||
        lowerErrorMessage.includes("failed get dir");

      if (isPasswordError || isObjectNotFoundError) {
        setPasswordPromptPath(pathToLoad);
        setShowPasswordDialog(true);
        
        if (lowerErrorMessage.includes("incorrect") || lowerErrorMessage.includes("permission") || (isObjectNotFoundError && directoryPasswords[pathToLoad])) {
            // If an "object not found" error occurs AND we had tried a password for this path, it's likely the password was wrong.
            setPasswordError(t('galleryPasswordIncorrectOrNoPermission'));
        } else if (isObjectNotFoundError) {
            // If "object not found" and no password was attempted, it might be a protected folder or truly not found.
             setPasswordError(t('galleryPasswordOrPathInvalid')); // New i18n key for this case
        }
         else {
            setPasswordError(t('galleryPasswordPossiblyRequired'));
        }
        setFiles([]);
      } else {
        toast.error(`${t('galleryErrorLoadingFiles')} ${errorMessage}`);
        setFiles([]);
      }
    } finally {
      setLoading(false);
    }
  }, [alistService, path, t, directoryPasswords, passwordPromptPath]);

  // Effect to load files when alistService or path changes
  useEffect(() => {
    console.log("Gallery useEffect: alistService or path changed", { alistService: !!alistService, path }); // Log effect trigger
    if (alistService) {
      loadFiles();
    } else {
      setFiles([]); // Clear files if service becomes null
    }

    // Cleanup blob URL when component unmounts or currentImageUrl changes
    return () => {
      if (currentImageUrl && currentImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentImageUrl);
      }
    };
  }, [alistService, path, loadFiles, currentImageUrl]); // Added currentImageUrl

  const handlePasswordSubmit = () => {
    if (!passwordPromptPath || !currentPasswordInput) return;
    setDirectoryPasswords(prev => ({ ...prev, [passwordPromptPath]: currentPasswordInput }));
    // loadFiles will be triggered by useEffect watching directoryPasswords if we update it,
    // or we can call it directly. Calling directly ensures immediate action.
    loadFiles(passwordPromptPath, currentPasswordInput);
    // setShowPasswordDialog(false); // Moved to loadFiles success
    // setCurrentPasswordInput(""); // Moved to loadFiles success
  };

  const handleNavigate = (file: FileInfo) => {
    if (file.is_dir) {
      onPathChange(`${path}${path.endsWith('/') ? '' : '/'}${file.name}`);
    } else {
      handleViewImage(file);
    }
  };

  const handleViewImage = async (file: FileInfo) => {
    if (!alistService) return;
    setIsPreviewLoading(true);
    setCurrentFile(file); // Save the current file info early

    // Revoke previous blob URL if it exists
    if (currentImageUrl && currentImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentImageUrl);
      setCurrentImageUrl(null);
    }
    setOriginalFileUrl(null);


    try {
      const directUrl = await alistService.getFileLink(`${path}${path.endsWith('/') ? '' : '/'}${file.name}`);
      setOriginalFileUrl(directUrl); // Store the original direct URL

      // Attempt to fetch all image types (including AVIF from R2 or other sources) as blob
      try {
        const response = await fetch(directUrl);
        if (!response.ok) {
          // If fetching as blob fails (e.g. CORS, network issue, 403),
          // fall back to using the direct URL for preview.
          // This might still trigger a download for some providers if the direct URL itself does.
          console.warn(`Failed to fetch image as blob (${response.status} ${response.statusText}), falling back to direct URL for: ${directUrl}`);
          setCurrentImageUrl(directUrl);
        } else {
          const blob = await response.blob();
          let typedBlob = blob;
          const fileExtension = file.name.split('.').pop()?.toLowerCase();
          const correctMimeType = getMimeType(fileExtension); // Helper function to get correct MIME type

          console.log(`Original blob type for ${file.name}: ${blob.type}`); // Log original type

          // Check if the blob type is not a standard image type and we can determine the correct MIME type from extension
          if (!blob.type.startsWith('image/') && correctMimeType) {
            try {
              typedBlob = new Blob([blob], { type: correctMimeType }); // Corrected typo
              console.log(`Created new blob with type ${correctMimeType} for`, file.name);
            } catch (blobError) {
              console.error("Error creating typed blob:", blobError);
              // Fallback to original blob if creating typed blob fails
              typedBlob = blob;
            }
          } else if (!blob.type.startsWith('image/')) {
             // Log a warning for other non-image types where we couldn't determine the correct type
             console.warn(`Fetched blob with non-image type: ${blob.type} for file: ${file.name}, could not determine correct type from extension.`);
          }
          console.log(`Blob type before creating URL for ${file.name}: ${typedBlob.type}`); // Log type before creating URL


          const blobUrl = URL.createObjectURL(typedBlob);
          setCurrentImageUrl(blobUrl);
        }
      } catch (fetchError: any) {
        // Catch fetch-specific errors (e.g., network errors, CORS rejections before response status)
        // Only log a warning here, as we are falling back to directUrl.
        // The toast error for "galleryErrorGettingImageLink" will be shown by the outer catch if directUrl also fails to load via <img>.
        console.warn(`Error fetching image for blob: ${fetchError.message}. Falling back to direct URL: ${directUrl}`);
        setCurrentImageUrl(directUrl); // Fallback to direct URL on fetch error
      }
    } catch (error: any) { // Catch errors from alistService.getFileLink itself, or other unexpected errors in the primary try block
      toast.error(`${t('galleryErrorGettingImageLink')} ${error.message || t('galleryUnknownError')}`);
      setCurrentImageUrl(null); // Clear image on error
      setOriginalFileUrl(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleCopyLink = async (file: FileInfo) => {
    if (!alistService) return;

    try {
      // Use originalFileUrl if available (meaning preview was opened), otherwise fetch it.
      let urlToCopy = originalFileUrl;
      if (currentFile === file && originalFileUrl) {
         urlToCopy = originalFileUrl;
      } else {
        urlToCopy = await alistService.getFileLink(`${path}${path.endsWith('/') ? '' : '/'}${file.name}`);
      }
      await navigator.clipboard.writeText(urlToCopy);
      toast.success(t('imageLinkCopied'));
    } catch (error: any) {
      toast.error(`${t('galleryErrorCopyingLink')} ${error.message || t('galleryUnknownError')}`);
    }
  };

  // New handler for Markdown link
  const handleCopyMarkdownLink = async (file: FileInfo) => {
    if (!alistService) return;
    try {
      let urlToCopy = originalFileUrl;
      if (currentFile === file && originalFileUrl) {
         urlToCopy = originalFileUrl;
      } else {
        urlToCopy = await alistService.getFileLink(`${path}${path.endsWith('/') ? '' : '/'}${file.name}`);
      }
      const markdownLink = `![${file.name}](${urlToCopy})`;
      await navigator.clipboard.writeText(markdownLink);
      toast.success(t('markdownLinkCopied'));
    } catch (error: any) {
      toast.error(`${t('galleryErrorCopyingMarkdownLink')} ${error.message || t('galleryUnknownError')}`);
    }
  };

  // New handler for HTML link
  const handleCopyHtmlLink = async (file: FileInfo) => {
    if (!alistService) return;
    try {
      let urlToCopy = originalFileUrl;
      if (currentFile === file && originalFileUrl) {
         urlToCopy = originalFileUrl;
      } else {
        urlToCopy = await alistService.getFileLink(`${path}${path.endsWith('/') ? '' : '/'}${file.name}`);
      }
      const htmlLink = `<img src="${urlToCopy}" alt="${file.name}">`;
      await navigator.clipboard.writeText(htmlLink);
      toast.success(t('htmlLinkCopied'));
    } catch (error: any) {
      toast.error(`${t('galleryErrorCopyingHtmlLink')} ${error.message || t('galleryUnknownError')}`);
    }
  };

  // New handler for UBB link
  const handleCopyUbbLink = async (file: FileInfo) => {
    if (!alistService) return;
    try {
      let urlToCopy = originalFileUrl;
      if (currentFile === file && originalFileUrl) {
         urlToCopy = originalFileUrl;
      } else {
        urlToCopy = await alistService.getFileLink(`${path}${path.endsWith('/') ? '' : '/'}${file.name}`);
      }
      const ubbLink = `[img]${urlToCopy}[/img]`;
      await navigator.clipboard.writeText(ubbLink);
      toast.success(t('ubbLinkCopied'));
    } catch (error: any) {
      toast.error(`${t('galleryErrorCopyingUbbLink')} ${error.message || t('galleryUnknownError')}`);
    }
  };

  // New handler for Thumbnail link
  const handleCopyThumbnailLink = async (file: FileInfo) => {
    if (!file.thumb) {
      toast.error(t('galleryThumbnailUrlNotAvailable')); // Use translation key
      return;
    }
    try {
      await navigator.clipboard.writeText(file.thumb);
      toast.success(t('thumbnailLinkCopied'));
    } catch (error: any) {
      toast.error(`${t('galleryErrorCopyingThumbnailLink')} ${error.message || t('galleryUnknownError')}`);
    }
  };

  const handleDelete = async (file: FileInfo) => {
    if (!alistService) return;

    if (!window.confirm(t('galleryConfirmDelete', { fileName: file.name }))) { // Use translation key with interpolation
      return;
    }

    try {
      await alistService.deleteFile(`${path}${path.endsWith('/') ? '' : '/'}${file.name}`);
      toast.success(t('galleryDeleteSuccess', { fileName: file.name })); // Use translation key with interpolation
      loadFiles();
    } catch (error: any) {
      toast.error(`${t('galleryErrorDeletingFile')} ${error.message || t('galleryUnknownError')}`); // Use translation key
    }
  };

  const navigateUp = () => {
    if (path === "/") return;

    const newPath = path.split("/").slice(0, -1).join("/") || "/";
    onPathChange(newPath);
  };

  // Helper function to determine MIME type based on file extension
  const getMimeType = (fileExtension?: string): string | undefined => {
    if (!fileExtension) return undefined;
    switch (fileExtension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'bmp':
        return 'image/bmp';
      case 'avif':
        return 'image/avif';
      // Add other image types if needed
      default:
        return undefined;
    }
  };

  const isImageFile = (file: FileInfo) => !file.is_dir && file.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|avif)$/i);
 
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={navigateUp}
            disabled={path === "/"}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t('galleryUp')}
          </Button>
          <span className="text-sm font-medium">{t('galleryCurrentPath')} {path}</span>
        </div>
        <div className="flex items-center space-x-2">
          {path !== "/" && ( // Show password button only if not in root
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPasswordPromptPath(path);
                setCurrentPasswordInput(directoryPasswords[path] || "");
                setShowPasswordDialog(true);
                setPasswordError(null); // Clear previous error
              }}
            >
              <KeyRound className="h-4 w-4 mr-1" />
              {t('galleryEnterPassword')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => loadFiles()}>
            {t('galleryRefresh')}
          </Button>
        </div>
      </div>

      <Dialog open={showPasswordDialog} onOpenChange={(isOpen) => {
        setShowPasswordDialog(isOpen);
        if (!isOpen) {
          setPasswordError(null); // Clear error when dialog is closed
          setCurrentPasswordInput(""); // Clear input when dialog is closed
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('galleryPasswordRequiredTitle')}</DialogTitle>
            <DialogDescription>
              {t('galleryPasswordRequiredDesc', { path: passwordPromptPath })}
              {passwordError && <p className="text-red-500 text-sm mt-2">{passwordError}</p>}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="dir-password" className="text-right">
                {t('galleryPasswordLabel')}
              </Label>
              <Input
                id="dir-password"
                type="password"
                value={currentPasswordInput}
                onChange={(e) => setCurrentPasswordInput(e.target.value)}
                className="col-span-3"
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setShowPasswordDialog(false);
              setPasswordError(null);
              setCurrentPasswordInput("");
            }}>
              {t('galleryPasswordDialogCancelButton')}
            </Button>
            <Button type="submit" onClick={handlePasswordSubmit}>{t('galleryPasswordDialogSubmitButton')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center p-12 text-gray-500">
          {t('galleryNoFilesFound')} {/* Use translation key */}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {files.map((file) => (
            <Card key={file.name} className="overflow-hidden">
              <CardContent className="p-0">
                <div
                  className="cursor-pointer"
                  onClick={() => handleNavigate(file)}
                >
                  {file.is_dir ? (
                    <div className="h-32 flex items-center justify-center bg-gray-100">
                      <FolderOpen className="h-12 w-12 text-yellow-500" />
                    </div>
                  ) : isImageFile(file) ? (
                    <div className="h-32 bg-black flex items-center justify-center overflow-hidden">
                      <img
                        src={file.thumb || ""}
                        alt={file.name}
                        className="object-cover h-full w-full"
                        onError={(e) => {
                          // Handle thumb loading error
                          e.currentTarget.src = '/placeholder.svg';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-32 flex items-center justify-center bg-gray-100">
                      <ImageIcon className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate" title={file.name}>
                    {file.name}
                  </p>
                  <div className="flex flex-col mt-2 space-y-2"> {/* Outer container for two rows */}
                    {!file.is_dir && isImageFile(file) && (
                      <>
                        {/* First row: Original, MD, HTML */}
                        <div className="flex justify-between items-center"> {/* Container for first row buttons */}
                          {/* Original Copy Link Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                            e.stopPropagation();
                            handleCopyLink(file); // This copies the raw URL
                            }}
                          >
                            <Link className="h-4 w-4" />
                          </Button>

                          {/* Thumbnail Button */}
                          {file.thumb && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={(e) => {
                              e.stopPropagation();
                              if (file.thumb) {
                                window.open(file.thumb, '_blank');
                              } else {
                                toast.error(t('galleryThumbnailUrlNotAvailable')); // Use translation key
                              }
                              }}
                            >
                              {t('thumbButton')}
                            </Button>
                          )}
                          {/* Existing Delete Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(file);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                         {/* Second row: UBB, Thumb, Delete */}
                        <div className="flex space-x-1 justify-center"> {/* Container for second row buttons */}
                          {/* Markdown Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={(e) => {
                            e.stopPropagation();
                            handleCopyMarkdownLink(file);
                            }}
                          >
                            {t('mdButton')}
                          </Button>
                          {/* HTML Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={(e) => {
                            e.stopPropagation();
                            handleCopyHtmlLink(file);
                            }}
                          >
                            {t('htmlButton')}
                          </Button>
                          {/* UBB Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={(e) => {
                            e.stopPropagation();
                            handleCopyUbbLink(file);
                            }}
                          >
                            {t('ubbButton')}
                          </Button>
                        </div>
                       </>
                     )}
                     {file.is_dir && (
                       <Button
                         variant="outline"
                         size="sm"
                         className="h-8 w-8 p-0"
                         onClick={(e) => {
                         e.stopPropagation();
                         handleNavigate(file);
                         }}
                       >
                         <FolderOpen className="h-4 w-4" />
                       </Button>
                     )}
                   </div>
                 </div>
               </CardContent>
             </Card>
           ))}
         </div>
       )}

       {/* Full screen preview - Needs update for video */}
       {/* Full screen preview - Updated for video */}
       {(currentFile && (currentImageUrl || isPreviewLoading)) && (
         <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
              onClick={() => {
                setCurrentFile(null);
                if (currentImageUrl && currentImageUrl.startsWith('blob:')) {
                  URL.revokeObjectURL(currentImageUrl);
                }
                setCurrentImageUrl(null);
                setOriginalFileUrl(null);
              }}> {/* Close on clicking outside */}
           {/* Dialog content container: overflow-hidden to manage overall dialog scroll, max-h for viewport fitting */}
           <div className="relative bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 rounded-lg max-w-4xl max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}> {/* Prevent closing when clicking inside */}
             {/* Header */}
             <div className="p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
               <h3 className="font-medium">{currentFile?.name || t('galleryImagePreview')}</h3> {/* Text color will be inherited */}
               <Button variant="ghost" size="sm" onClick={() => {
                 setCurrentFile(null);
                 if (currentImageUrl && currentImageUrl.startsWith('blob:')) {
                   URL.revokeObjectURL(currentImageUrl);
                 }
                 setCurrentImageUrl(null);
                 setOriginalFileUrl(null);
               }}>
                 {t('galleryClose')} {/* Use translation key */}
               </Button>
             </div>
             {/* Image Container: overflow-auto for scrolling, dynamic maxHeight */}
             <div
                className={`p-4 ${showFullImage ? 'overflow-auto' : 'flex items-center justify-center'}`} // Apply overflow-auto only when zoomed, apply centering when not zoomed
                style={{
                  maxHeight: 'calc(90vh - 120px)',
                  width: showFullImage ? 'auto' : '100%', // Allow container to take full available width in modal
                  height: showFullImage ? 'auto' : 'auto', // Let content and maxHeight determine height
                  overflow: showFullImage ? 'auto' : 'hidden'
                }}
             >
              {isPreviewLoading && (
                <Loader2 className="h-16 w-16 animate-spin text-gray-500 dark:text-gray-400" />
              )}
              {!isPreviewLoading && currentImageUrl && (
                <img
                  src={currentImageUrl}
                  alt={currentFile?.name || "Preview"}
                  className={`${showFullImage ? 'cursor-zoom-out' : 'cursor-zoom-in object-contain'}`} // Apply object-contain when not zoomed
                  style={{
                    display: isPreviewLoading ? 'none' : 'block',
                    maxWidth: showFullImage ? 'none' : '100%', // Allow original size when zoomed, limit to container when not zoomed
                    maxHeight: showFullImage ? 'none' : '100%', // Allow original size when zoomed, limit to container when not zoomed
                    width: showFullImage ? 'auto' : 'auto', // Allow original width when zoomed, auto when not zoomed
                    height: showFullImage ? 'auto' : 'auto', // Allow original height when zoomed, auto when not zoomed
                  }}
                  onClick={() => setShowFullImage(!showFullImage)}
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder.svg'; // Fallback for blob load error
                    toast.error(t('galleryErrorLoadingPreview'));
                  }}
                />
              )}
              {!isPreviewLoading && !currentImageUrl && currentFile && (
                 <div className="text-center text-red-500 dark:text-red-400">
                   <p>{t('galleryErrorLoadingPreview')}</p>
                   {originalFileUrl && (
                     <a href={originalFileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 underline">
                       {t('galleryTryOpeningDirectly')}
                     </a>
                   )}
                 </div>
              )}
             </div>
             {/* Footer */}
             <div className="p-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
               <Button onClick={() => {
                 if (currentImageUrl) { // Now copies the currentImageUrl (blob or direct)
                   navigator.clipboard.writeText(currentImageUrl);
                   toast.success(t('imageLinkCopied'));
                 } else {
                   toast.error(t('galleryErrorNoLinkToCopy'));
                 }
               }}>
                 {t('copyPreviewLinkButton')} {/* Changed translation key */}
               </Button>
                <Button onClick={() => setShowFullImage(!showFullImage)} disabled={!currentImageUrl || isPreviewLoading}>
                  {showFullImage ? t('zoomOutButton') : t('zoomInButton')} {/* New translation keys */}
                </Button>
             </div>
           </div>
         </div>
       )}

       {/* Image Carousel */}
       {files.filter(isImageFile).length > 0 && (
         <div className="mt-8">
           <h3 className="text-lg font-semibold mb-4">{t('galleryImageCarousel')}</h3> {/* Use translation key */}
           <Carousel
             className="w-full"
             plugins={[
               Autoplay({
                 delay: 10000, // 10 seconds
                 stopOnInteraction: true, // Optional: stop autoplay on user interaction
               }),
             ]}
             opts={{
               loop: true, // Optional: loop the carousel
             }}
           >
             <CarouselContent>
               {files.filter(isImageFile).map((file) => (
                 <CarouselItem key={file.name} className="md:basis-1/2 lg:basis-1/3">
                   <div className="p-1">
                     <Card>
                       <CardContent className="flex aspect-square items-center justify-center p-6">
                         <img
                           src={file.thumb || ""}
                           alt={file.name}
                           className="object-cover h-full w-full rounded"
                           onClick={() => handleViewImage(file)}
                           style={{cursor: 'pointer'}}
                           onError={(e) => {
                             e.currentTarget.src = '/placeholder.svg';
                           }}
                         />
                       </CardContent>
                     </Card>
                   </div>
                 </CarouselItem>
               ))}
             </CarouselContent>
             <CarouselPrevious />
             <CarouselNext />
           </Carousel>
         </div>
       )}
     </div>
   );
 };

export default Gallery;
