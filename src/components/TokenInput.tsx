
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlistService } from "@/services/alistService";
import { toast } from "sonner";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface TokenInputProps {
  initialToken?: string;
  initialServerUrl?: string;
  isUpdate?: boolean;
  onSubmit: (token: string, serverUrl: string) => void;
}

const TokenInput: React.FC<TokenInputProps> = ({ 
  initialToken = "", 
  initialServerUrl = "",
  isUpdate = false, 
  onSubmit 
}) => {
  const [token, setToken] = useState<string>(initialToken);
  const [serverUrl, setServerUrl] = useState<string>(initialServerUrl);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<string | null>(null);

  const validateAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setError(null);
    setDetailedError(null);
    
    if (!token.trim() || !serverUrl.trim()) {
      setError("Please enter both server URL and token");
      toast.error("Please enter both server URL and token");
      return;
    }
    
    // Remove trailing slash if present
    const normalizedUrl = serverUrl.trim().endsWith('/') 
      ? serverUrl.trim().slice(0, -1) 
      : serverUrl.trim();
    
    // Add https:// if not present
    const urlWithProtocol = normalizedUrl.startsWith('http') 
      ? normalizedUrl 
      : `https://${normalizedUrl}`;
    
    setIsValidating(true);
    try {
      // Show what values we're using for connection
      console.log("Connecting with URL:", urlWithProtocol);
      console.log("Token length:", token.trim().length);
      
      // Test the connection before saving
      const testService = new AlistService(token.trim(), urlWithProtocol);
      const isValid = await testService.testConnection();
      
      if (isValid) {
        onSubmit(token.trim(), urlWithProtocol);
        toast.success("Connection successful!");
      } else {
        const errorMsg = "Could not connect to AList. Please check your token and server URL.";
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (error: any) {
      const errorMsg = `Connection failed: ${error.message || 'Unknown error'}`;
      setError(errorMsg);
      setDetailedError(`Error details: ${JSON.stringify(error, null, 2)}`);
      toast.error(errorMsg);
    } finally {
      setIsValidating(false);
    }
  };

  // Try to fix potential token format issues
  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Remove any accidental whitespace
    setToken(value.trim());
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isUpdate ? "Update AList Connection" : "Connect to AList"}</CardTitle>
        <CardDescription>
          {isUpdate 
            ? "Update your AList server URL and token to maintain access" 
            : "Enter your AList server URL and token to access your images"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={validateAndSubmit}>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Connection Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              {detailedError && (
                <div className="mt-2 text-xs bg-gray-900 text-white p-2 rounded overflow-auto max-h-32">
                  {detailedError}
                </div>
              )}
            </Alert>
          )}

          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="serverUrl">AList Server URL</Label>
              <Input
                id="serverUrl"
                placeholder="https://your-alist-server.com"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                required
                disabled={isValidating}
              />
              <p className="text-xs text-gray-500">Example: your-alist-server.com (https:// will be added automatically if missing)</p>
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="token">AList Token</Label>
              <Input
                id="token"
                placeholder="Enter your AList token"
                value={token}
                onChange={handleTokenChange}
                required
                disabled={isValidating}
              />
              <p className="text-xs text-gray-500">
                Get your token from AList admin dashboard: Settings → Other → Token
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isValidating}>
            {isValidating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              isUpdate ? "Update Connection" : "Connect"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default TokenInput;
