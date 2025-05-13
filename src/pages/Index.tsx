
import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import TokenInput from "@/components/TokenInput";
import ImageUploader from "@/components/ImageUploader";
import Gallery from "@/components/Gallery";
import { AlistService } from "@/services/alistService";

const Index = () => {
  const [token, setToken] = useState<string>(() => {
    return localStorage.getItem("alist_token") || "";
  });
  const [path, setPath] = useState<string>("/");
  const [alistService, setAlistService] = useState<AlistService | null>(null);

  // Initialize AlistService when token changes
  useEffect(() => {
    if (token) {
      localStorage.setItem("alist_token", token);
      const service = new AlistService(token);
      setAlistService(service);
    } else {
      localStorage.removeItem("alist_token");
      setAlistService(null);
    }
  }, [token]);

  const handleTokenSubmit = (newToken: string) => {
    setToken(newToken);
    toast.success("Token saved successfully!");
  };

  const handleUploadSuccess = () => {
    toast.success("Image uploaded successfully!");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-purple-700 mb-2">AList Image Gallery</h1>
          <p className="text-gray-600">Upload and manage your images with AList</p>
        </header>

        {!token && (
          <TokenInput onSubmit={handleTokenSubmit} />
        )}

        {token && (
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="upload">Upload Images</TabsTrigger>
              <TabsTrigger value="gallery">Gallery</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload">
              <ImageUploader
                alistService={alistService}
                currentPath={path}
                onUploadSuccess={handleUploadSuccess}
              />
            </TabsContent>
            
            <TabsContent value="gallery">
              <Gallery
                alistService={alistService}
                path={path}
                onPathChange={setPath}
              />
            </TabsContent>
            
            <TabsContent value="settings">
              <TokenInput 
                initialToken={token} 
                onSubmit={handleTokenSubmit} 
                isUpdate={true} 
              />
            </TabsContent>
          </Tabs>
        )}

        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>AList Image Gallery &copy; {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
