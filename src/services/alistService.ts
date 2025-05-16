
import axios from "axios";

export interface FileInfo {
  name: string;
  size: number;
  is_dir: boolean;
  modified: string;
  sign?: string;
  thumb?: string;
  type: number;
}

export interface ListResponse {
  content: FileInfo[];
  total: number;
  readme: string;
  write: boolean;
  provider: string;
}

export class AlistService {
  private client; // Let TypeScript infer the type from axios.create()
  private baseUrl: string;
  private token?: string;
  private username?: string;
  private password?: string;
  private r2CustomDomain?: string; // New private member

  constructor(
    authDetails: { token: string } | { username?: string; password?: string },
    baseUrl: string = "",
    r2CustomDomain?: string // New optional parameter
  ) {
    this.baseUrl = baseUrl.trim();
    this.r2CustomDomain = r2CustomDomain?.trim().endsWith('/')
      ? r2CustomDomain.trim().slice(0, -1)
      : r2CustomDomain?.trim();
    if ("token" in authDetails) {
      this.token = authDetails.token.trim();
    } else {
      this.username = authDetails.username?.trim();
      this.password = authDetails.password; // Password should not be trimmed if it contains spaces
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: this.token ? { Authorization: this.token } : {},
    });
  }

  private async _login(): Promise<void> {
    if (!this.username || !this.password) {
      throw new Error("Username and password are required for login.");
    }
    try {
      const response = await this.client.post("/api/auth/login", {
        username: this.username,
        password: this.password,
      });
      if (response.data && response.data.code === 200 && response.data.data && response.data.data.token) {
        this.token = response.data.data.token;
        this.client.defaults.headers.common["Authorization"] = this.token;
        // Clear username and password after successful login for security
        this.username = undefined;
        this.password = undefined;
      } else {
        throw new Error(
          `Login failed: ${response.data.message || "Invalid credentials or server error"}`
        );
      }
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.response) {
        throw new Error(
          `Login failed: ${error.response.data?.message || error.response.statusText || "Server error"}`
        );
      } else if (error.request) {
        throw new Error(
          "Login failed: No response from server. Please check your server URL and network connection."
        );
      }
      throw error;
    }
  }

  // 设置基础 URL
  setBaseUrl(url: string) {
    this.baseUrl = url.trim();
    this.client.defaults.baseURL = this.baseUrl;
  }

  // 设置Token
  setToken(token: string) {
    this.token = token.trim();
    this.username = undefined; // Clear username/password if token is set directly
    this.password = undefined;
    this.client.defaults.headers.common["Authorization"] = this.token;
  }

  // Method to set username and password
  setCredentials(username?: string, password?: string) {
    this.username = username?.trim();
    this.password = password;
    this.token = undefined; // Clear token if credentials are set
    delete this.client.defaults.headers.common["Authorization"];
  }

  // 获取当前基础URL
  getBaseUrl(): string {
    return this.baseUrl;
  }

  // Test connection to verify credentials
  async testConnection(): Promise<boolean> {
    try {
      if (!this.token && this.username && this.password) {
        console.log("Attempting login before testing connection...");
        await this._login();
      }

      if (!this.token) {
        throw new Error("No token available for testing connection. Please provide a token or username/password.");
      }

      console.log('Testing connection with URL:', this.baseUrl);
      console.log('Authorization header (first 5 chars):', this.token ? `${this.token.substring(0, 5)}...` : 'No token');
      
      const response = await this.client.post('/api/fs/list', { path: '/' });
      console.log('Connection test response:', response.data);
      
      if (response.data && response.data.code === 401) {
        console.error('Authentication failed during testConnection:', response.data.message);
        throw new Error(`Authentication failed: ${response.data.message || 'Invalid token or credentials'}`);
      }
      
      return response.data && response.data.code === 200;
    } catch (error: any) {
      console.error('Connection test failed:', error.message);
      
      if (error.response) {
        console.error('Server error details:', error.response.data);
        console.error('Status code:', error.response.status);
        if (error.response.status === 401) {
          throw new Error(`Authentication failed: ${error.response.data?.message || 'Token or credentials might be invalid'}`);
        }
        throw new Error(`Server error: ${error.response.data?.message || error.response.statusText || 'Unknown server error'}`);
      } else if (error.request) {
        console.error('No response received for request:', error.request);
        throw new Error('No response from server. Please check your server URL and network connection.');
      }
      throw error; // Re-throw other errors
    }
  }

  // 获取文件列表
  async listFiles(path: string, password?: string): Promise<FileInfo[]> {
    try {
      console.log('Listing files at path:', path, password ? "with password" : "without password");
      if (!this.token && this.username && this.password) {
        // This login is for the main AList account, separate from directory passwords
        await this._login();
      }
      // AList directory passwords are often separate from main account authentication.
      // Even with a valid token, accessing an encrypted directory might still require its specific password.

      const requestBody: { path: string; password?: string; page?: number; per_page?: number; refresh?: boolean } = {
        path,
        // page: 1, // Default or allow customization
        // per_page: 0, // Default (no pagination) or allow customization
        // refresh: false // Default or allow customization
      };
      if (password) {
        requestBody.password = password;
      }

      const response = await this.client.post('/api/fs/list', requestBody);
      
      if (response.data && response.data.code === 200 && response.data.data && response.data.data.content) {
        return response.data.data.content;
      } else {
        console.log('Response structure (listFiles):', JSON.stringify(response.data));
        if (response.data && response.data.code === 401) {
          // This could be main auth failure or directory password issue.
          // AList API might return 401 if a password is required but not provided for a protected directory.
          if (response.data.message && (response.data.message.toLowerCase().includes("password") || response.data.message.toLowerCase().includes("unauthorized"))) {
             throw new Error(`Directory access denied: ${response.data.message}. A password may be required or is incorrect.`);
          }
          throw new Error(`Authentication failed: ${response.data.message || 'Please check your token/credentials and server URL'}`);
        }
        // Handle "object not found" which can occur with incorrect directory passwords
        if (response.data && response.data.code === 500 && response.data.message &&
            (response.data.message.toLowerCase().includes("object not found") || response.data.message.toLowerCase().includes("failed get dir"))) {
            throw new Error(`Failed to list files: ${response.data.message}. This can be due to an incorrect directory password or the path does not exist.`);
        }
        if (response.data && response.data.code !== 200) {
          throw new Error(`Server error (listFiles): ${response.data.message || 'Unknown error'}`);
        }
        return [];
      }
    } catch (error: any) {
      console.error('Error listing files:', error.message);
      // Re-throw the error so the UI layer can catch it and prompt for a password if needed
      throw error;
    }
  }

  // 上传文件
  async uploadFile(path: string, file: File): Promise<any> {
    try {
      if (!this.token && this.username && this.password) {
        await this._login();
      }
      if (!this.token) throw new Error("Not authenticated for uploadFile");

      const fullPath = `${path}${path.endsWith('/') ? '' : '/'}${file.name}`;
      const encodedFullPath = encodeURIComponent(fullPath);

      const response = await this.client.put(`/api/fs/put`, file, {
        headers: {
          'File-Path': encodedFullPath,
          // Authorization is now handled by client defaults or _login
        }
      });

      if (response.data && response.data.code === 401) {
        throw new Error('Authentication failed (uploadFile) - please check your token/credentials and server URL');
      }
      if (response.data && response.data.code !== 200) {
         throw new Error(`Upload failed: ${response.data.message || 'Unknown error from AList API (uploadFile)'}`);
      }
      return response.data;
    } catch (error: any) {
      console.error('Error uploading file:', error.message);
      if (error.response) {
         throw new Error(`Upload failed: ${error.response.data?.message || error.response.statusText || 'Server error (uploadFile)'}`);
      } else if (error.request) {
         throw new Error('Upload failed: No response from server (uploadFile). Please check your server URL and network connection.');
      }
      throw error;
    }
  }

  // 获取文件链接（直接预览或下载）
  async getFileLink(path: string): Promise<string> {
    try {
      if (!this.token && this.username && this.password) {
        await this._login();
      }
      if (!this.token) throw new Error("Not authenticated");

      const response = await this.client.post('/api/fs/get', { path });
      
      if (response.data && response.data.code === 200 && response.data.data && response.data.data.raw_url) {
        let rawUrl = response.data.data.raw_url;
        // Protocol normalization
        if (rawUrl.includes("sharepoint.com")) {
          // For SharePoint links, ensure HTTPS
          if (rawUrl.startsWith("http:")) {
            rawUrl = rawUrl.replace(/^http:/, "https:");
          }
        } else if (typeof window !== 'undefined') {
          // Apply original protocol normalization for non-SharePoint URLs
          if (window.location.protocol === 'https:') {
            rawUrl = rawUrl.replace(/^http:/, 'https:');
          } else if (window.location.protocol === 'http:') {
            rawUrl = rawUrl.replace(/^https:/, 'http:');
          }
        }

        // R2 Link Transformation
        if (rawUrl.includes(".r2.cloudflarestorage.com")) {
          try {
            const urlObject = new URL(rawUrl);
            const pathname = urlObject.pathname; // Should be like "/filename.ext"
            if (pathname && this.r2CustomDomain) { // Check if r2CustomDomain is set
              const filename = pathname.substring(1); // Remove leading '/'
              const newR2Url = `${this.r2CustomDomain}/${filename}`;
              console.log(`R2 URL transformed: ${rawUrl} -> ${newR2Url}`);
              return newR2Url; // Return the new R2 URL
            } else if (pathname && !this.r2CustomDomain) {
              console.log("R2 link detected, but no custom domain configured. Returning original R2 link.");
            }
          } catch (e) {
            console.error("Error parsing R2 URL for transformation:", e);
            // Fall through to return original rawUrl if parsing fails
          }
        }
        // End of R2 Link Transformation

        // No more SharePoint specific URL transformations here for web=1 or embed.aspx,
        // as that will be handled by fetching the blob in the component for SharePoint.
        return rawUrl;
      } else {
        console.log('Response structure for file link (getFileLink):', JSON.stringify(response.data));
        if (response.data && response.data.code === 401) {
          throw new Error('Authentication failed - please check your token/credentials and server URL (getFileLink)');
        }
        if (response.data && response.data.code !== 200) {
            throw new Error(`Server error (getFileLink): ${response.data.message || 'Unknown error'}`);
        }
        return '';
      }
    } catch (error: any) {
      console.error('Error getting file link:', error.message);
      throw error;
    }
  }

  // 创建文件夹
  async createFolder(path: string, name: string): Promise<any> {
    try {
      if (!this.token && this.username && this.password) {
        await this._login();
      }
      if (!this.token) throw new Error("Not authenticated");

      const response = await this.client.post('/api/fs/mkdir', {
        path: `${path}/${name}` // Assuming path is the parent directory and name is the new folder name
      });
      
      if (response.data && response.data.code === 401) {
        throw new Error('Authentication failed - please check your token/credentials and server URL (createFolder)');
      }
      if (response.data && response.data.code !== 200) {
        throw new Error(`Folder creation failed: ${response.data.message || 'Unknown error from AList API (createFolder)'}`);
      }
      return response.data;
    } catch (error: any) {
      console.error('Error creating folder:', error.message);
      throw error;
    }
  }

  // 删除文件或文件夹
  async deleteFile(path: string): Promise<any> {
    try {
      if (!this.token && this.username && this.password) {
        await this._login();
      }
      if (!this.token) throw new Error("Not authenticated for deleteFile");

      const lastSlashIndex = path.lastIndexOf('/');
      let dir = '/';
      let name = path;

      if (lastSlashIndex !== -1) {
        dir = path.substring(0, lastSlashIndex) || '/';
        name = path.substring(lastSlashIndex + 1);
      }

      const response = await this.client.post('/api/fs/remove', {
        names: [name],
        dir: dir
      });
      
      if (response.data && response.data.code === 401) {
        throw new Error('Authentication failed (deleteFile) - please check your token/credentials and server URL');
      }
      if (response.data && response.data.code !== 200) {
        throw new Error(`Deletion failed: ${response.data.message || 'Unknown error from AList API (deleteFile)'}`);
      }
      return response.data;
    } catch (error: any) {
      console.error('Error deleting file:', error.message);
      if (error.response) {
         throw new Error(`Deletion failed: ${error.response.data?.message || error.response.statusText || 'Server error (deleteFile)'}`);
      } else if (error.request) {
         throw new Error('Deletion failed: No response from server (deleteFile). Please check your server URL and network connection.');
      }
      throw error;
    }
  }
}
