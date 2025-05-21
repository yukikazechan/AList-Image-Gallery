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

// Define and export AuthDetails type
export type AuthDetails = ({ token: string } | { username?: string; password?: string });

interface YourlsResponse {
  status?: string; // 'success' or 'fail'
  code?: string; // Can also be 'success' or an error code like 'error:keyword'
  shorturl?: string;
  message?: string; // Error message
  remark?: string; // Sometimes used for error messages too
  title?: string;
  url?: { // This structure might appear for 'success' status with existing short URL
    keyword: string;
    url: string; // The original long URL
    title: string;
    date: string;
    ip: string;
    clicks: string;
  };
}


export class AlistService {
  private client; // Let TypeScript infer the type from axios.create()
  private baseUrl: string;
  private token?: string;
  private username?: string;
  private password?: string;
  private r2CustomDomain?: string;
  private isPublicClient: boolean = false; // Flag to indicate if client is unauthenticated

  constructor(
    authDetails: AuthDetails | null, // Use the exported AuthDetails type
    baseUrl: string = "",
    r2CustomDomain?: string
  ) {
    this.baseUrl = baseUrl.trim();
    this.r2CustomDomain = r2CustomDomain?.trim().endsWith('/')
      ? r2CustomDomain.trim().slice(0, -1)
      : r2CustomDomain?.trim();

    let headers: Record<string, string> = {};
    if (authDetails) {
      if ("token" in authDetails && authDetails.token) {
        this.token = authDetails.token.trim();
        headers["Authorization"] = this.token;
      } else if ("username" in authDetails && typeof authDetails.username === 'string') { // Password can be empty string
        this.username = authDetails.username.trim();
        this.password = authDetails.password || ""; // Default to empty string if undefined
        // Authorization header will be set after successful _login for username/password
      } else {
        // authDetails provided but not in a valid format for token or username
        this.isPublicClient = true; // Treat as public if authDetails is malformed or empty object
      }
    } else {
      this.isPublicClient = true; // No authDetails provided, operate as public client
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: headers, // Set headers based on token, or empty for public/password-auth-pending-login
    });
  }

  private async _login(): Promise<void> {
    // This login is only attempted if username and password were provided at construction
    if (typeof this.username !== 'string' || typeof this.password !== 'string') {
      // Should not happen if called correctly, but as a safeguard:
      throw new Error("Login attempt without username/password. This service instance might be public or token-based.");
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

  // 获取当前R2自定义域名
  getR2CustomDomain(): string | undefined {
    return this.r2CustomDomain;
  }

  // 获取当前Token
  getCurrentToken(): string | undefined {
    return this.token;
  }

  // 获取是否为公共客户端
  getIsPublicClient(): boolean {
    return this.isPublicClient;
  }

  // Test connection to verify credentials
  async testConnection(): Promise<boolean> {
    try {
      // testConnection is primarily for authenticated instances
      if (this.isPublicClient) {
        console.warn("testConnection called on a public client instance. This typically tests credentials.");
      }

      if (!this.token && typeof this.username === 'string' && typeof this.password === 'string') {
        console.log("Attempting login before testing connection...");
        await this._login();
      }

      if (!this.token && !this.isPublicClient) { 
        throw new Error("No token available for testing connection. Please provide a token or username/password.");
      }
      
      console.log('Testing connection with URL:', this.baseUrl);
      console.log('Authorization header (first 5 chars):', this.token ? `${this.token.substring(0, 5)}...` : (this.isPublicClient ? 'Public Client' : 'No token'));
      
      const response = await this.client.post('/api/fs/list', { path: '/' });
      console.log('Connection test response:', response.data);
      
      if (response.data && response.data.code === 401 && !this.isPublicClient) {
        console.error('Authentication failed during testConnection:', response.data.message);
        throw new Error(`Authentication failed: ${response.data.message || 'Invalid token or credentials'}`);
      }
      
      return response.data && response.data.code === 200;
    } catch (error: any) {
      console.error('Connection test failed:', error.message);
      
      if (error.response) {
        console.error('Server error details:', error.response.data);
        console.error('Status code:', error.response.status);
        if (error.response.status === 401 && !this.isPublicClient) {
          throw new Error(`Authentication failed: ${error.response.data?.message || 'Token or credentials might be invalid'}`);
        }
        throw new Error(`Server error: ${error.response.data?.message || error.response.statusText || 'Unknown server error'}`);
      } else if (error.request) {
        console.error('No response received for request:', error.request);
        throw new Error('No response from server. Please check your server URL and network connection.');
      }
      throw error; 
    }
  }

  // 获取文件列表
  async listFiles(path: string, password?: string, page?: number, per_page?: number): Promise<ListResponse> {
    try {
      console.log('Listing files at path:', path, password ? "with password" : (this.isPublicClient ? "as public client" : "without directory password"), `page: ${page}`, `per_page: ${per_page}`);
      if (!this.isPublicClient && !this.token && typeof this.username === 'string' && typeof this.password === 'string') {
        await this._login();
      }

      const requestBody: { path: string; password?: string; page?: number; per_page?: number; refresh?: boolean } = { path };
      if (password) {
        requestBody.password = password;
      }
      if (page !== undefined) {
        requestBody.page = page;
      }
      if (per_page !== undefined) {
        requestBody.per_page = per_page;
      }

      const response = await this.client.post('/api/fs/list', requestBody);
      
      if (response.data && response.data.code === 200 && response.data.data) {
        return {
          content: response.data.data.content || [],
          total: response.data.data.total || 0,
          readme: response.data.data.readme || "",
          write: response.data.data.write || false,
          provider: response.data.data.provider || ""
        };
      } else {
        console.log('Response structure (listFiles):', JSON.stringify(response.data));
        if (response.data && response.data.code === 401) {
          if (this.isPublicClient && !password) { 
             throw new Error(`Access denied for path '${path}': ${response.data.message || 'Path may require login or a directory password.'}`);
          }
          if (response.data.message && (response.data.message.toLowerCase().includes("password") || response.data.message.toLowerCase().includes("unauthorized"))) {
             throw new Error(`Directory access denied: ${response.data.message}. A password may be required or is incorrect.`);
          }
          if (!this.isPublicClient) {
            throw new Error(`Authentication failed: ${response.data.message || 'Please check your token/credentials and server URL'}`);
          }
        }
        if (response.data && response.data.code === 500 && response.data.message &&
            (response.data.message.toLowerCase().includes("object not found") || response.data.message.toLowerCase().includes("failed get dir"))) {
            throw new Error(`Failed to list files: ${response.data.message}. This can be due to an incorrect directory password or the path does not exist.`);
        }
        if (response.data && response.data.code !== 200) {
          throw new Error(`Server error (listFiles): ${response.data.message || 'Unknown error'}`);
        }
        throw new Error('Server error (listFiles): API response data structure is not as expected.');
      }
    } catch (error: any) {
      console.error('Error listing files:', error.message);
      throw error;
    }
  }

  // 上传文件
  async uploadFile(path: string, file: File, desiredFileNameOnServer?: string): Promise<any> {
    try {
      if (this.isPublicClient) {
        throw new Error("Upload is not allowed for public (unauthenticated) client.");
      }
      if (!this.token && typeof this.username === 'string' && typeof this.password === 'string') {
        await this._login();
      }
      if (!this.token) { 
        throw new Error("Not authenticated for uploadFile. Token is missing.");
      }

      const actualFileName = desiredFileNameOnServer || file.name;
      const fullPath = `${path}${path.endsWith('/') ? '' : '/'}${actualFileName}`;
      const encodedFullPath = encodeURIComponent(fullPath);

      const response = await this.client.put(`/api/fs/put`, file, {
        headers: {
          'File-Path': encodedFullPath,
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
      if (!this.isPublicClient && !this.token && typeof this.username === 'string' && typeof this.password === 'string') {
        await this._login();
      }
      if (!this.isPublicClient && !this.token) {
        throw new Error("Not authenticated for getFileLink (protected resource). Token is missing.");
      }

      const response = await this.client.post('/api/fs/get', { path });
      
      if (response.data && response.data.code === 200 && response.data.data && response.data.data.raw_url) {
        let rawUrl = response.data.data.raw_url;

        // Removed SharePoint specific Web=1 addition
        // Protocol adjustment based on window.location
        if (typeof window !== 'undefined') {
          if (window.location.protocol === 'https:') {
            if (rawUrl.startsWith("http:")) rawUrl = rawUrl.replace(/^http:/, 'https:');
          } else if (window.location.protocol === 'http:') {
            if (rawUrl.startsWith("https:")) rawUrl = rawUrl.replace(/^https:/, 'http:');
          }
        }

        if (rawUrl.includes(".r2.cloudflarestorage.com")) {
          try {
            const urlObject = new URL(rawUrl);
            const pathname = urlObject.pathname; 
            if (pathname && this.r2CustomDomain) {
              const relativePath = pathname.startsWith('/') ? pathname.substring(1) : pathname;
              const newR2Url = `${this.r2CustomDomain}/${relativePath}`;
              console.log(`R2 URL transformed: ${rawUrl} -> ${newR2Url}`);
              return newR2Url;
            } else if (pathname && !this.r2CustomDomain) {
              console.log("R2 link detected, but no custom domain configured. Returning original R2 link.");
            }
          } catch (e) {
            console.error("Error parsing R2 URL for transformation:", e);
          }
        }
        
        return rawUrl; 
      } else {
        console.log('Response structure for file link (getFileLink):', JSON.stringify(response.data));
        if (response.data && response.data.code === 401) {
          if (this.isPublicClient) {
            throw new Error(`Access to file link for '${path}' denied: ${response.data.message || 'Path may require login.'}`);
          } else {
            throw new Error('Authentication failed - please check your token/credentials and server URL (getFileLink)');
          }
        }
        if (response.data && response.data.code !== 200) {
            throw new Error(`Server error (getFileLink): ${response.data.message || 'Unknown error from AList API'}`);
        }
        throw new Error('Failed to retrieve a valid file link from AList API (getFileLink): raw_url missing in response.');
      }
    } catch (error: any) {
      console.error('Error getting file link:', error.message);
      throw error; 
    }
  }

  // 创建文件夹
  async createFolder(path: string, name: string): Promise<any> {
    try {
      if (this.isPublicClient) {
        throw new Error("Folder creation is not allowed for public (unauthenticated) client.");
      }
      if (!this.token && typeof this.username === 'string' && typeof this.password === 'string') {
        await this._login();
      }
      if (!this.token) { 
        throw new Error("Not authenticated for createFolder. Token is missing.");
      }

      const response = await this.client.post('/api/fs/mkdir', {
        path: `${path}${path.endsWith('/') ? '' : '/'}${name}` 
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
      if (this.isPublicClient) {
        throw new Error("Deletion is not allowed for public (unauthenticated) client.");
      }
      if (!this.token && typeof this.username === 'string' && typeof this.password === 'string') {
        await this._login();
      }
      if (!this.token) { 
        throw new Error("Not authenticated for deleteFile. Token is missing.");
      }

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
// Method to delete multiple files/folders
  async deleteMultipleFiles(fullPaths: string[]): Promise<{ success: boolean; results: { path: string; success: boolean; error?: string }[] }> {
    if (this.isPublicClient) {
      throw new Error("Deletion is not allowed for public (unauthenticated) client.");
    }
    if (!this.token && typeof this.username === 'string' && typeof this.password === 'string') {
      await this._login();
    }
    if (!this.token) {
      throw new Error("Not authenticated for deleteMultipleFiles. Token is missing.");
    }

    if (!fullPaths || fullPaths.length === 0) {
      return { success: true, results: [] }; // Nothing to delete
    }

    const groupedByDirectory: Record<string, string[]> = {};
    for (const fullPath of fullPaths) {
      const lastSlashIndex = fullPath.lastIndexOf('/');
      const dir = lastSlashIndex === -1 ? '/' : (fullPath.substring(0, lastSlashIndex) || '/');
      const name = lastSlashIndex === -1 ? fullPath : fullPath.substring(lastSlashIndex + 1);
      
      if (!name) continue; 

      if (!groupedByDirectory[dir]) {
        groupedByDirectory[dir] = [];
      }
      groupedByDirectory[dir].push(name);
    }

    const overallResults: { path: string; success: boolean; error?: string }[] = [];
    let allSucceeded = true;

    for (const dir in groupedByDirectory) {
      const names = groupedByDirectory[dir];
      if (names.length === 0) continue;

      try {
        console.log(`[AlistService] Deleting ${names.length} items from directory: ${dir}`, names);
        const response = await this.client.post('/api/fs/remove', {
          names: names,
          dir: dir
        });

        if (response.data && response.data.code === 200) {
          names.forEach(name => overallResults.push({ path: `${dir === '/' && !name.startsWith('/') ? '' : dir.replace(/\/$/, '')}/${name}`, success: true }));
        } else {
          allSucceeded = false;
          const errorMessage = response.data?.message || 'Unknown error from AList API (deleteMultipleFiles)';
          console.error(`[AlistService] Failed to delete items from ${dir}:`, errorMessage, names);
          names.forEach(name => overallResults.push({ path: `${dir === '/' && !name.startsWith('/') ? '' : dir.replace(/\/$/, '')}/${name}`, success: false, error: errorMessage }));
        }
      } catch (error: any) {
        allSucceeded = false;
        const errorMessage = error.response?.data?.message || error.message || 'Server error (deleteMultipleFiles)';
        console.error(`[AlistService] Exception during deletion from ${dir}:`, errorMessage, names);
        names.forEach(name => overallResults.push({ path: `${dir === '/' && !name.startsWith('/') ? '' : dir.replace(/\/$/, '')}/${name}`, success: false, error: errorMessage }));
      }
    }
    return { success: allSucceeded, results: overallResults };
  }

  // 获取短链接 (YOURLS)
  async getShortUrl(longUrl: string): Promise<string> {
    const yourlsApiUrl = localStorage.getItem("yourls_url");
    const yourlsSignature = localStorage.getItem("yourls_token");

    if (yourlsApiUrl && yourlsSignature) {
      const apiUrl = `${yourlsApiUrl.replace(/\/$/, '')}/yourls-api.php`;
      try {
        const params = new URLSearchParams();
        params.append('signature', yourlsSignature);
        params.append('action', 'shorturl');
        params.append('url', longUrl);
        params.append('format', 'json');

        console.log(`[AlistService] Requesting short URL via POST to: ${apiUrl}`);
        console.log(`[AlistService] POST params: signature=${yourlsSignature}, action=shorturl, url=${longUrl.substring(0,100)}..., format=json`);
        
        const response = await axios.post<YourlsResponse>(apiUrl, params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        console.log('[AlistService] YOURLS API POST Response Status:', response.status);
        console.log('[AlistService] YOURLS API POST Response Data:', response.data);

        if (response.data && (response.data.status === 'success' || String(response.data.code).startsWith('success')) && response.data.shorturl) {
          console.log(`[AlistService] Short URL received: ${response.data.shorturl}`);
          return response.data.shorturl;
        } else {
          console.warn('[AlistService] YOURLS API (POST) did not return a success status or shorturl. Data:', response.data);
          const errorMessage = response.data?.message || response.data?.remark || 'YOURLS API error (POST)';
          return longUrl; 
        }
      } catch (error: any) {
        console.error('[AlistService] Error calling YOURLS API (POST):', error.message);
        // Check if error is an Axios-like error and has a response object
        if (error && typeof error === 'object' && 'isAxiosError' in error && (error as any).isAxiosError === true && (error as any).response) {
          console.error('[AlistService] YOURLS API (POST) AxiosError Response Data:', (error as any).response.data);
          console.error('[AlistService] YOURLS API (POST) AxiosError Response Status:', (error as any).response.status);
        } else if (error && typeof error === 'object' && 'response' in error && (error as any).response) { 
            console.error('[AlistService] YOURLS API (POST) HTTP Error Data:', (error as any).response.data);
            console.error('[AlistService] YOURLS API (POST) HTTP Error Status:', (error as any).response.status);
        } else {
            console.error('[AlistService] YOURLS API (POST) Non-HTTP Error:', error);
        }
        return longUrl; 
      }
    }
    return longUrl; 
  }
}
