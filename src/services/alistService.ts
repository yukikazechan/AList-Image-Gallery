
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
  private baseUrl: string = "https://alist.example.com"; // 用户需要配置实际的 AList 服务器地址
  
  constructor(token: string) {
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

  // 获取文件列表
  async listFiles(path: string): Promise<FileInfo[]> {
    try {
      const response = await this.client.post('/api/fs/list', { path });
      return response.data.data.content || [];
    } catch (error) {
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
      return response.data.data.raw_url || '';
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
      return response.data;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }
}
