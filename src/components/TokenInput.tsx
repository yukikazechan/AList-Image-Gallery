
import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlistService } from "@/services/alistService";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

  const validateAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token.trim() || !serverUrl.trim()) {
      toast.error("Please enter both server URL and token");
      return;
    }
    
    // Remove trailing slash if present
    const normalizedUrl = serverUrl.trim().endsWith('/') 
      ? serverUrl.trim().slice(0, -1) 
      : serverUrl.trim();
    
    setIsValidating(true);
    try {
      // Test the connection before saving
      const testService = new AlistService(token.trim(), normalizedUrl);
      const isValid = await testService.testConnection();
      
      if (isValid) {
        onSubmit(token.trim(), normalizedUrl);
        toast.success("Connection successful!");
      } else {
        toast.error("Could not connect to AList. Please check your token and server URL.");
      }
    } catch (error: any) {
      toast.error(`Connection failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsValidating(false);
    }
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
              <p className="text-xs text-gray-500">Example: https://your-alist-server.com (without trailing slash)</p>
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="token">AList Token</Label>
              <Input
                id="token"
                placeholder="Enter your AList token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                disabled={isValidating}
              />
              <p className="text-xs text-gray-500">
                Get your token from AList admin dashboard: Settings → Login → Get Token
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
