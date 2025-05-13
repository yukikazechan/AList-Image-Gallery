
import React, { useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlistService } from "@/services/alistService";
import { Upload } from "lucide-react";

interface ImageUploaderProps {
  alistService: AlistService | null;
  currentPath: string;
  onUploadSuccess: () => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  alistService,
  currentPath,
  onUploadSuccess
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    setFiles(selectedFiles);
    
    if (selectedFiles && selectedFiles.length > 0) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(selectedFiles[0]);
    } else {
      setImagePreviewUrl(null);
    }
  };

  const handleUpload = useCallback(async () => {
    if (!alistService || !files || files.length === 0) {
      toast.error("Please select a file to upload");
      return;
    }

    setIsUploading(true);
    setUploadedImageUrl(null);

    try {
      const file = files[0];
      
      // Check if the file is an image
      if (!file.type.startsWith('image/')) {
        toast.error("Only image files are allowed");
        setIsUploading(false);
        return;
      }

      await alistService.uploadFile(currentPath, file);
      
      // Get the file link
      const fileLink = await alistService.getFileLink(`${currentPath}/${file.name}`);
      setUploadedImageUrl(fileLink);
      
      onUploadSuccess();
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  }, [alistService, files, currentPath, onUploadSuccess]);

  const copyToClipboard = useCallback(() => {
    if (uploadedImageUrl) {
      navigator.clipboard.writeText(uploadedImageUrl);
      toast.success("Image URL copied to clipboard");
    }
  }, [uploadedImageUrl]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Images</CardTitle>
        <CardDescription>Upload your images to AList</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="mb-4"
            />
            
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
              disabled={!files || isUploading}
              className="mt-4"
            >
              {isUploading ? (
                "Uploading..."
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Image
                </>
              )}
            </Button>
          </div>

          {uploadedImageUrl && (
            <div className="mt-6 space-y-4">
              <h3 className="font-medium">Uploaded Image URL</h3>
              <div className="flex items-center space-x-2">
                <Input
                  value={uploadedImageUrl}
                  readOnly
                  className="flex-1"
                />
                <Button onClick={copyToClipboard} variant="outline">
                  Copy
                </Button>
              </div>
              <div className="mt-2">
                <img
                  src={uploadedImageUrl}
                  alt="Uploaded"
                  className="max-h-64 max-w-full rounded-lg"
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ImageUploader;
