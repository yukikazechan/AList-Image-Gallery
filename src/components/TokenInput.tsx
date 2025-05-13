
import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface TokenInputProps {
  initialToken?: string;
  isUpdate?: boolean;
  onSubmit: (token: string) => void;
}

const TokenInput: React.FC<TokenInputProps> = ({ initialToken = "", isUpdate = false, onSubmit }) => {
  const [token, setToken] = useState<string>(initialToken);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      onSubmit(token.trim());
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isUpdate ? "Update AList Token" : "Connect to AList"}</CardTitle>
        <CardDescription>
          {isUpdate 
            ? "Update your AList token to maintain access" 
            : "Enter your AList token to access your images"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <div className="grid w-full items-center gap-4">
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
            {isUpdate ? "Update Token" : "Connect"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default TokenInput;
