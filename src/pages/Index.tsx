
import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import TokenInput from "@/components/TokenInput";
import ImageUploader from "@/components/ImageUploader";
import Gallery from "@/components/Gallery";
import { AlistService } from "@/services/alistService";
import { useTranslation } from 'react-i18next'; // Import useTranslation

const Index = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  const [token, setToken] = useState<string>(localStorage.getItem("alist_token") || "");
  const [username, setUsername] = useState<string>(localStorage.getItem("alist_username") || "");
  const [password, setPassword] = useState<string>(localStorage.getItem("alist_password") || "");
  const [serverUrl, setServerUrl] = useState<string>(localStorage.getItem("alist_server_url") || "");
  const [path, setPath] = useState<string>("/");
  const [alistService, setAlistService] = useState<AlistService | null>(null);
  const [activeTab, setActiveTab] = useState<string>("upload");
  const [connectionVerified, setConnectionVerified] = useState<boolean>(false);
  // Store which auth method was last successfully used or attempted
  const [authMethod, setAuthMethod] = useState<"token" | "credentials" | null>(() => {
    if (localStorage.getItem("alist_token")) return "token";
    if (localStorage.getItem("alist_username")) return "credentials";
    return null;
  });

  useEffect(() => {
    let service: AlistService | null = null;
    let currentAuthDetails: { token: string } | { username?: string; password?: string } | null = null;

    if (serverUrl) {
      if (authMethod === "token" && token) {
        currentAuthDetails = { token };
        localStorage.setItem("alist_token", token);
        localStorage.removeItem("alist_username");
        localStorage.removeItem("alist_password");
      } else if (authMethod === "credentials" && username) { // Password can be empty
        currentAuthDetails = { username, password };
        localStorage.setItem("alist_username", username);
        localStorage.setItem("alist_password", password);
        localStorage.removeItem("alist_token");
      }
      localStorage.setItem("alist_server_url", serverUrl);

      if (currentAuthDetails) {
        service = new AlistService(currentAuthDetails, serverUrl);
      }
    } else {
      localStorage.removeItem("alist_token");
      localStorage.removeItem("alist_username");
      localStorage.removeItem("alist_password");
      localStorage.removeItem("alist_server_url");
    }
    
    setAlistService(service);

    if (service) {
      service.testConnection()
        .then(isValid => {
          setConnectionVerified(isValid);
          if (!isValid) {
            toast.error(t("connectionError"));
          }
        })
        .catch(error => {
          console.error("Connection test error:", error);
          setConnectionVerified(false);
          // toast.error(`${t("connectionError")}: ${error.message}`);
        });
    } else {
      setConnectionVerified(false);
    }
  }, [token, username, password, serverUrl, authMethod, t]);

  const handleConnectionSubmit = (
    authDetails: { token: string } | { username?: string; password?: string },
    newServerUrl: string
  ) => {
    setServerUrl(newServerUrl);
    if ("token" in authDetails) {
      setToken(authDetails.token);
      setUsername(""); // Clear other auth method
      setPassword("");
      setAuthMethod("token");
    } else {
      setToken(""); // Clear other auth method
      setUsername(authDetails.username || "");
      setPassword(authDetails.password || "");
      setAuthMethod("credentials");
    }
    // Connection test and toast will be handled by useEffect
  };

  const handleUploadSuccess = () => {
    toast.success(t("uploadSuccess")); // Use translation key
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-purple-700 mb-2">{t("appName")}</h1> {/* Use translation key */}
          <p className="text-gray-600">{t("appDescription")}</p> {/* Use translation key */}
        </header>

        {!connectionVerified && (
          <TokenInput
            initialToken={token}
            initialServerUrl={serverUrl}
            initialUsername={username}
            initialPassword={password}
            onSubmit={handleConnectionSubmit}
            isUpdate={!!((token || username) && serverUrl)} // Show as update if any credential exists
          />
        )}

        {connectionVerified && alistService && (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="upload">{t("uploadTab")}</TabsTrigger> {/* Use translation key */}
              <TabsTrigger value="gallery">{t("galleryTab")}</TabsTrigger> {/* Use translation key */}
              <TabsTrigger value="settings">{t("settingsTab")}</TabsTrigger> {/* Use translation key */}
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
                initialUsername={username}
                initialPassword={password}
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
