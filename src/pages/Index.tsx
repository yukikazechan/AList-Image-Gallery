
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
  const [serverUrl, setServerUrl] = useState<string>(() => {
    return localStorage.getItem("alist_server_url") || "";
  });
  const [path, setPath] = useState<string>("/");
  const [alistService, setAlistService] = useState<AlistService | null>(null);
  const [activeTab, setActiveTab] = useState<string>("upload");
  const [connectionVerified, setConnectionVerified] = useState<boolean>(false);

  // Initialize AlistService when token changes
  useEffect(() => {
    if (token && serverUrl) {
      localStorage.setItem("alist_token", token);
      localStorage.setItem("alist_server_url", serverUrl);
      
      const service = new AlistService(token, serverUrl);
      setAlistService(service);
      
      // Test connection
      service.testConnection()
        .then(isValid => {
          setConnectionVerified(isValid);
          if (!isValid) {
            toast.error("Could not connect to AList with the provided credentials");
          }
        })
        .catch(error => {
          console.error("Connection test error:", error);
          setConnectionVerified(false);
        });
    } else {
      if (!token) localStorage.removeItem("alist_token");
      if (!serverUrl) localStorage.removeItem("alist_server_url");
      setAlistService(null);
      setConnectionVerified(false);
    }
  }, [token, serverUrl]);

  const handleConnectionSubmit = (newToken: string, newServerUrl: string) => {
    setToken(newToken);
    setServerUrl(newServerUrl);
    // Toast success message will be shown after connection is tested
  };

  const handleUploadSuccess = () => {
    toast.success("Image uploaded successfully!");
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-purple-700 mb-2">AList Image Gallery</h1>
          <p className="text-gray-600">Upload and manage your images with AList</p>
        </header>

        {(!token || !serverUrl || !connectionVerified) && (
          <TokenInput 
            initialToken={token} 
            initialServerUrl={serverUrl}
            onSubmit={handleConnectionSubmit} 
            isUpdate={!!(token && serverUrl && !connectionVerified)}
          />
        )}

        {token && serverUrl && connectionVerified && (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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
                onPathChange={setPath}
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
                initialServerUrl={serverUrl}
                onSubmit={handleConnectionSubmit} 
                isUpdate={true} 
              />
            </TabsContent>
          </Tabs>
        )}

        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>AList Image Gallery &copy; 2025 by arikacips</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
