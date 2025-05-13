
import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim() && serverUrl.trim()) {
      onSubmit(token.trim(), serverUrl.trim());
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
      <form onSubmit={handleSubmit}>
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
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit">
            {isUpdate ? "Update Connection" : "Connect"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default TokenInput;
