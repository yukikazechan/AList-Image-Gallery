import axios, { AxiosInstance } from "axios";

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
  private client: AxiosInstance;
  private baseUrl: string;
  
  constructor(token: string, baseUrl: string = "") {
    this.baseUrl = baseUrl || "";
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // 设置基础 URL
  setBaseUrl(url: string) {
    this.baseUrl = url;
    this.client.defaults.baseURL = url;
  }

  // 获取当前基础URL
  getBaseUrl(): string {
    return this.baseUrl;
  }

  // Test connection to verify credentials
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.post('/api/fs/list', { path: '/' });
      console.log('Connection test response:', response.data);
      
      if (response.data && response.data.code === 401) {
        console.error('Authentication failed:', response.data.message);
        throw new Error(`Authentication failed: ${response.data.message || 'Invalid token'}`);
      }
      
      return response.data && response.data.code === 200;
    } catch (error: any) {
      console.error('Connection test failed:', error);
      
      // Handle Axios errors
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Server error:', error.response.data);
        if (error.response.status === 401) {
          throw new Error(`Authentication failed: ${error.response.data?.message || 'Invalid token'}`);
        }
        throw new Error(`Server error: ${error.response.data?.message || error.response.statusText || 'Unknown server error'}`);
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error('No response from server. Please check your server URL and network connection.');
      }
      
      // Re-throw the original error if it's not an Axios error
      throw error;
    }
  }

  // 获取文件列表
  async listFiles(path: string): Promise<FileInfo[]> {
    try {
      const response = await this.client.post('/api/fs/list', { path });
      
      // Check if request was successful
      if (response.data && response.data.code === 200 && response.data.data && response.data.data.content) {
        return response.data.data.content;
      } else {
        console.log('Response structure:', JSON.stringify(response.data));
        if (response.data && response.data.code === 401) {
          throw new Error('Authentication failed - please check your token and server URL');
        }
        if (response.data && response.data.code !== 200) {
          throw new Error(`Server error: ${response.data.message || 'Unknown error'}`);
        }
        return []; // Return empty array if content is not available
      }
    } catch (error: any) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  // 上传文件
  async uploadFile(path: string, file: File): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await this.client.put(`/api/fs/put`, formData, {
        params: { path: `${path}/${file.name}` },
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data && response.data.code === 401) {
        throw new Error('Authentication failed - please check your token and server URL');
      }
      
      return response.data;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  // 获取文件链接（直接预览或下载）
  async getFileLink(path: string): Promise<string> {
    try {
      const response = await this.client.post('/api/fs/get', { path });
      
      // Check if response is successful
      if (response.data && response.data.code === 200 && response.data.data && response.data.data.raw_url) {
        return response.data.data.raw_url;
      } else {
        console.log('Response structure for file link:', JSON.stringify(response.data));
        if (response.data && response.data.code === 401) {
          throw new Error('Authentication failed - please check your token and server URL');
        }
        return ''; // Return empty string if raw_url is not available
      }
    } catch (error) {
      console.error('Error getting file link:', error);
      throw error;
    }
  }

  // 创建文件夹
  async createFolder(path: string, name: string): Promise<any> {
    try {
      const response = await this.client.post('/api/fs/mkdir', {
        path: `${path}/${name}`
      });
      
      if (response.data && response.data.code === 401) {
        throw new Error('Authentication failed - please check your token and server URL');
      }
      
      return response.data;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  // 删除文件或文件夹
  async deleteFile(path: string): Promise<any> {
    try {
      const response = await this.client.post('/api/fs/remove', { path });
      
      if (response.data && response.data.code === 401) {
        throw new Error('Authentication failed - please check your token and server URL');
      }
      
      return response.data;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }
}
