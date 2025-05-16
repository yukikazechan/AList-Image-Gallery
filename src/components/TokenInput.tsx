
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlistService } from "@/services/alistService";
import { toast } from "sonner";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface TokenInputProps {
  initialToken?: string;
  initialServerUrl?: string;
  initialUsername?: string;
  initialPassword?: string;
  initialR2CustomDomain?: string; // New prop
  isUpdate?: boolean;
  onSubmit: (
    authDetails: { token: string } | { username?: string; password?: string },
    serverUrl: string,
    r2CustomDomain?: string // New parameter in onSubmit
  ) => void;
}

type AuthMode = "token" | "credentials";

const TokenInput: React.FC<TokenInputProps> = ({
  initialToken = "",
  initialServerUrl = "",
  initialUsername = "",
  initialPassword = "",
  initialR2CustomDomain = "", // Initialize new prop
  isUpdate = false,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [token, setToken] = useState<string>(initialToken);
  const [serverUrl, setServerUrl] = useState<string>(initialServerUrl);
  const [username, setUsername] = useState<string>(initialUsername);
  const [password, setPassword] = useState<string>(initialPassword);
  const [r2CustomDomain, setR2CustomDomain] = useState<string>(initialR2CustomDomain); // New state
  const [authMode, setAuthMode] = useState<AuthMode>("token");
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isGuestConnecting, setIsGuestConnecting] = useState<boolean>(false); // New state for guest button loading
  const [error, setError] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<string | null>(null);

  useEffect(() => {
    // If initial token is provided, default to token mode.
    // Otherwise, if initial username is provided, default to credentials mode.
    if (initialToken) {
      setAuthMode("token");
    } else if (initialUsername) {
      setAuthMode("credentials");
    }
  }, [initialToken, initialUsername]);

  const validateAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDetailedError(null);

    const normalizedUrl = serverUrl.trim().endsWith("/")
      ? serverUrl.trim().slice(0, -1)
      : serverUrl.trim();
    const urlWithProtocol = normalizedUrl.startsWith("http")
      ? normalizedUrl
      : `https://${normalizedUrl}`;

    if (!urlWithProtocol) {
      setError(t("tokenInputEnterServerUrl"));
      toast.error(t("tokenInputEnterServerUrl"));
      return;
    }

    let authDetails: { token: string } | { username?: string; password?: string };
    let serviceToTest: AlistService;

    if (authMode === "token") {
      if (!token.trim()) {
        setError(t("tokenInputEnterToken"));
        toast.error(t("tokenInputEnterToken"));
        return;
      }
      authDetails = { token: token.trim() };
      serviceToTest = new AlistService(authDetails, urlWithProtocol);
    } else {
      if (!username.trim() || !password) { // Password can be empty string but not undefined
        setError(t("tokenInputEnterUsernamePassword"));
        toast.error(t("tokenInputEnterUsernamePassword"));
        return;
      }
      authDetails = { username: username.trim(), password: password };
      serviceToTest = new AlistService(authDetails, urlWithProtocol);
    }

    setIsValidating(true);
    try {
      console.log("Connecting with URL:", urlWithProtocol);
      if (authMode === "token") {
        console.log("Token length:", token.trim().length);
      } else {
        console.log("Username:", username.trim());
      }
      
      const isValid = await serviceToTest.testConnection();

      if (isValid) {
        onSubmit(authDetails, urlWithProtocol, r2CustomDomain.trim()); // Pass r2CustomDomain
        toast.success(t("tokenInputConnectionSuccessful"));
      } else {
        const errorMsg = t("tokenInputConnectionFailed");
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (error: any) {
      const errorMsg = `${t("tokenInputConnectionFailedGeneric")} ${error.message || t("imageUploaderUnknownLoadingError")}`;
      setError(errorMsg);
      setDetailedError(`${t("tokenInputErrorDetails")} ${JSON.stringify(error, null, 2)}`);
      toast.error(errorMsg);
    } finally {
      setIsValidating(false);
    }
  };

  const handleGuestConnect = async () => {
    setError(null);
    setDetailedError(null);
    setIsGuestConnecting(true); // Start guest button loading

    const guestServerUrl = "https://pan.arikacips.cyou";
    const guestUsername = "test";
    const guestPassword = "test";

    try {
      // Call the onSubmit prop with guest credentials directly
      // Do NOT set the input field states to maintain privacy
      await onSubmit({ username: guestUsername, password: guestPassword }, guestServerUrl, "");

      // onSubmit will handle success toast and state updates
    } catch (error: any) {
      // onSubmit should handle most errors and display toasts
      // This catch is for unexpected errors during the process before onSubmit is fully handled
      console.error("Error during guest connection process:", error);
      const errorMsg = `${t("tokenInputConnectionFailedGeneric")} ${error.message || t("imageUploaderUnknownLoadingError")}`;
      setError(errorMsg);
      setDetailedError(`${t("tokenInputErrorDetails")} ${JSON.stringify(error, null, 2)}`);
      toast.error(errorMsg);
    } finally {
      setIsGuestConnecting(false); // Stop guest button loading
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
        <CardTitle>{isUpdate ? t("tokenInputUpdateTitle") : t("tokenInputConnectTitle")}</CardTitle>
        <CardDescription>
          {isUpdate
            ? t("tokenInputUpdateDescription")
            : t("tokenInputConnectDescription")}
        </CardDescription>
      </CardHeader>
      <form onSubmit={validateAndSubmit}>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t("tokenInputConnectionErrorAlert")}</AlertTitle>
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
              <Label htmlFor="serverUrl">{t("tokenInputServerUrlLabel")}</Label>
              <Input
                id="serverUrl"
                placeholder={t("tokenInputServerUrlPlaceholder")}
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                required
                disabled={isValidating}
              />
              <p className="text-xs text-gray-500">{t("tokenInputServerUrlHint")}</p>
            </div>

            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="r2CustomDomain">{t("tokenInputR2CustomDomainLabel")}</Label>
              <Input
                id="r2CustomDomain"
                placeholder={t("tokenInputR2CustomDomainPlaceholder")}
                value={r2CustomDomain}
                onChange={(e) => setR2CustomDomain(e.target.value)}
                disabled={isValidating}
              />
              <p className="text-xs text-gray-500">{t("tokenInputR2CustomDomainHint")}</p>
            </div>

            <div className="flex flex-col space-y-1.5">
              <Label>{t("tokenInputAuthMethodLabel")}</Label>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant={authMode === "token" ? "default" : "outline"}
                  onClick={() => setAuthMode("token")}
                  disabled={isValidating}
                >
                  {t("tokenInputAuthModeToken")}
                </Button>
                <Button
                  type="button"
                  variant={authMode === "credentials" ? "default" : "outline"}
                  onClick={() => setAuthMode("credentials")}
                  disabled={isValidating}
                >
                  {t("tokenInputAuthModeCredentials")}
                </Button>
              </div>
            </div>

            {authMode === "token" && (
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="token">{t("tokenInputTokenLabel")}</Label>
                <Input
                  id="token"
                  placeholder={t("tokenInputTokenPlaceholder")}
                  value={token}
                  onChange={handleTokenChange}
                  required={authMode === "token"}
                  disabled={isValidating}
                />
                <p className="text-xs text-gray-500">{t("tokenInputTokenHint")}</p>
              </div>
            )}

            {authMode === "credentials" && (
              <>
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="username">{t("tokenInputUsernameLabel")}</Label>
                  <Input
                    id="username"
                    placeholder={t("tokenInputUsernamePlaceholder")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.trim())}
                    required={authMode === "credentials"}
                    disabled={isValidating}
                  />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="password">{t("tokenInputPasswordLabel")}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t("tokenInputPasswordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={authMode === "credentials"}
                    disabled={isValidating}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between"> {/* Use flex and justify-between for button spacing */}
          <Button type="submit" disabled={isValidating || isGuestConnecting}> {/* Disable if either is loading */}
            {isValidating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("tokenInputConnecting")}
              </>
            ) : isUpdate ? (
              t("tokenInputUpdateButton")
            ) : (
              t("tokenInputConnectButton")
            )}
          </Button>
          <Button
            type="button" // Important: prevent form submission
            variant={
              initialServerUrl === "https://pan.arikacips.cyou" &&
              initialUsername === "test" &&
              initialPassword === "test"
                ? "default" // Black variant when guest mode is active
                : "outline" // Default outline variant
            }
            onClick={handleGuestConnect}
            disabled={isValidating || isGuestConnecting} // Disable if either is loading
          >
            {isGuestConnecting ? (
               <>
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                 {t("tokenInputConnecting")} {/* Reuse connecting text for guest */}
               </>
            ) : (
              t("tokenInputGuestConnectButton")
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default TokenInput;
