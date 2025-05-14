
import React, { useState, useEffect } from "react";
import { AlistService, FileInfo } from "@/services/alistService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  FolderOpen, 
  Image as ImageIcon, 
  Link, 
  Trash2,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { 
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface GalleryProps {
  alistService: AlistService | null;
  path: string;
  onPathChange: (path: string) => void;
}

const Gallery: React.FC<GalleryProps> = ({ alistService, path, onPathChange }) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<FileInfo | null>(null); // Add state for current file info
  const [showFullImage, setShowFullImage] = useState<boolean>(false);

  const loadFiles = async () => {
    if (!alistService) return;
    
    setLoading(true);
    try {
      const filesList = await alistService.listFiles(path);
      // Filter to only show directories and images
      const filteredFiles = filesList.filter(file =>
        file.is_dir || file.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|avif|mp4|webm|mov|avi|mkv)$/i)
      );
      setFiles(filteredFiles);
    } catch (error: any) {
      toast.error(`Error loading files: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [alistService, path]);

  const handleNavigate = (file: FileInfo) => {
    if (file.is_dir) {
      onPathChange(`${path}${path.endsWith('/') ? '' : '/'}${file.name}`);
    } else {
      handleViewImage(file);
    }
  };

  const handleViewImage = async (file: FileInfo) => {
    if (!alistService) return;
    
    try {
      const fileUrl = await alistService.getFileLink(`${path}${path.endsWith('/') ? '' : '/'}${file.name}`);
      setCurrentImageUrl(fileUrl);
      setCurrentFile(file); // Save the current file info
    } catch (error: any) {
      toast.error(`Error getting image link: ${error.message || 'Unknown error'}`);
    }
  };

  const handleCopyLink = async (file: FileInfo) => {
    if (!alistService) return;
    
    try {
      const fileUrl = await alistService.getFileLink(`${path}${path.endsWith('/') ? '' : '/'}${file.name}`);
      await navigator.clipboard.writeText(fileUrl);
      toast.success("Image link copied to clipboard");
    } catch (error: any) {
      toast.error(`Error copying link: ${error.message || 'Unknown error'}`);
    }
  };

  // New handler for Markdown link
  const handleCopyMarkdownLink = async (file: FileInfo) => {
    if (!alistService) return;
    try {
      const fileUrl = await alistService.getFileLink(`${path}${path.endsWith('/') ? '' : '/'}${file.name}`);
      const markdownLink = `![${file.name}](${fileUrl})`;
      await navigator.clipboard.writeText(markdownLink);
      toast.success("Markdown link copied to clipboard");
    } catch (error: any) {
      toast.error(`Error copying Markdown link: ${error.message || 'Unknown error'}`);
    }
  };

  // New handler for HTML link
  const handleCopyHtmlLink = async (file: FileInfo) => {
    if (!alistService) return;
    try {
      const fileUrl = await alistService.getFileLink(`${path}${path.endsWith('/') ? '' : '/'}${file.name}`);
      const htmlLink = `<img src="${fileUrl}" alt="${file.name}">`;
      await navigator.clipboard.writeText(htmlLink);
      toast.success("HTML link copied to clipboard");
    } catch (error: any) {
      toast.error(`Error copying HTML link: ${error.message || 'Unknown error'}`);
    }
  };

  // New handler for UBB link
  const handleCopyUbbLink = async (file: FileInfo) => {
    if (!alistService) return;
    try {
      const fileUrl = await alistService.getFileLink(`${path}${path.endsWith('/') ? '' : '/'}${file.name}`);
      const ubbLink = `[img]${fileUrl}[/img]`;
      await navigator.clipboard.writeText(ubbLink);
      toast.success("UBB link copied to clipboard");
    } catch (error: any) {
      toast.error(`Error copying UBB link: ${error.message || 'Unknown error'}`);
    }
  };

  // New handler for Thumbnail link
  const handleCopyThumbnailLink = async (file: FileInfo) => {
    if (!file.thumb) {
      toast.error("Thumbnail URL not available");
      return;
    }
    try {
      await navigator.clipboard.writeText(file.thumb);
      toast.success("Thumbnail link copied to clipboard");
    } catch (error: any) {
      toast.error(`Error copying Thumbnail link: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDelete = async (file: FileInfo) => {
    if (!alistService) return;

    if (!window.confirm(`Are you sure you want to delete ${file.name}?`)) {
      return;
    }

    try {
      await alistService.deleteFile(`${path}${path.endsWith('/') ? '' : '/'}${file.name}`);
      toast.success(`${file.name} deleted successfully`);
      loadFiles();
    } catch (error: any) {
      toast.error(`Error deleting file: ${error.message || 'Unknown error'}`);
    }
  };

  const navigateUp = () => {
    if (path === "/") return;

    const newPath = path.split("/").slice(0, -1).join("/") || "/";
    onPathChange(newPath);
  };

  const isImageFile = (file: FileInfo) => !file.is_dir && file.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|avif)$/i);

  const isVideoFile = (file: FileInfo) => !file.is_dir && file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i);

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
            Up
          </Button>
          <span className="text-sm font-medium">Current path: {path}</span>
        </div>
        <Button variant="outline" size="sm" onClick={loadFiles}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center p-12 text-gray-500">
          No images or folders found in this directory
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
                  ) : isVideoFile(file) ? (
                    <div className="h-32 bg-black flex items-center justify-center overflow-hidden">
                       <video
                         src={file.thumb || ""} // Use thumb for poster if available, or consider a default video thumbnail
                         controls // Add controls for playback
                         className="object-cover h-full w-full"
                         poster={file.thumb || '/placeholder.svg'} // Use thumbnail as poster
                       >
                         Your browser does not support the video tag.
                       </video>
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
                    {!file.is_dir && (isImageFile(file) || isVideoFile(file)) && (
                      <>
                        {/* First row: Original, MD, HTML */}
                        <div className="flex space-x-1"> {/* Container for first row buttons */}
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

                          {/* Markdown Button */}
                          {isImageFile(file) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={(e) => {
                              e.stopPropagation();
                              handleCopyMarkdownLink(file);
                              }}
                            >
                              MD
                            </Button>
                          )}
                          {/* HTML Button */}
                           {isImageFile(file) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={(e) => {
                              e.stopPropagation();
                              handleCopyHtmlLink(file);
                              }}
                            >
                              HTML
                            </Button>
                           )}
                        </div>

                        {/* Second row: UBB, Thumb, Delete */}
                        <div className="flex space-x-1 justify-end"> {/* Container for second row buttons, align to end */}
                          {/* UBB Button */}
                          {isImageFile(file) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={(e) => {
                              e.stopPropagation();
                              handleCopyUbbLink(file);
                              }}
                            >
                              UBB
                            </Button>
                          )}
                          {/* Thumbnail Button */}
                          {file.thumb && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={(e) => {
                              e.stopPropagation();
                              handleCopyThumbnailLink(file);
                              }}
                            >
                              Thumb
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
      {currentFile && currentImageUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
             onClick={() => setCurrentFile(null)}> {/* Close on clicking outside */}
          <div className="relative bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-hidden"
               onClick={(e) => e.stopPropagation()}> {/* Prevent closing when clicking inside */}
            <div className="p-4 flex justify-between items-center border-b">
              <h3 className="font-medium">{isVideoFile(currentFile) ? 'Video Preview' : 'Image Preview'}</h3>
              <Button variant="ghost" size="sm" onClick={() => setCurrentFile(null)}>
                Close
              </Button>
            </div>
            <div className="p-4 overflow-auto" style={{maxHeight: 'calc(90vh - 60px)'}}>
              {isVideoFile(currentFile) ? (
                 <video
                   src={currentImageUrl}
                   controls
                   className="max-w-full max-h-[70vh]"
                 >
                   Your browser does not support the video tag.
                 </video>
              ) : (
                <img
                  src={currentImageUrl}
                  alt="Preview"
                  className={`max-w-full ${showFullImage ? '' : 'max-h-[70vh]'}`}
                  style={{cursor: showFullImage ? 'zoom-out' : 'zoom-in'}}
                  onClick={() => setShowFullImage(!showFullImage)}
                />
              )}
            </div>
            <div className="p-4 border-t">
              <Button onClick={() => {
                navigator.clipboard.writeText(currentImageUrl);
                toast.success("Media URL copied to clipboard");
              }}>
                Copy Media URL
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Image Carousel - Needs update for video */}
      {(files.filter(isImageFile).length > 0 || files.filter(isVideoFile).length > 0) && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Media Carousel</h3>
          <Carousel className="w-full">
            <CarouselContent>
              {files.filter(file => isImageFile(file) || isVideoFile(file)).map((file) => (
                <CarouselItem key={file.name} className="md:basis-1/2 lg:basis-1/3">
                  <div className="p-1">
                    <Card>
                      <CardContent className="flex aspect-square items-center justify-center p-6">
                        {isImageFile(file) ? (
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
                        ) : isVideoFile(file) ? (
                           <video
                             src={file.thumb || ""} // Use thumb for poster if available
                             controls
                             className="object-cover h-full w-full rounded"
                             poster={file.thumb || '/placeholder.svg'} // Use thumbnail as poster
                             onClick={() => handleViewImage(file)} // Allow clicking to open full preview
                             style={{cursor: 'pointer'}}
                           >
                             Your browser does not support the video tag.
                           </video>
                        ) : null}
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
