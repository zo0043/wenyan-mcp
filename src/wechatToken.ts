import axios from 'axios';
import fs from 'fs';
import path from 'path';

const TOKEN_FILE = path.resolve(process.cwd(), 'wechat_access_token.json');
const APP_ID = process.env.WECHAT_APP_ID || '';
const APP_SECRET = process.env.WECHAT_APP_SECRET || '';

interface TokenData {
  access_token: string;
  expires_at: number; // 时间戳，单位秒
}

function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] [WECHAT_TOKEN] ${message}`;
  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
}

// 读取本地 token 文件
function readTokenFile(): TokenData | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const raw = fs.readFileSync(TOKEN_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    log('warn', 'Failed to read token file', e);
    return null;
  }
}

// 写入本地 token 文件
function writeTokenFile(token: string, expires_in: number) {
  const expires_at = Math.floor(Date.now() / 1000) + expires_in - 60; // 提前1分钟过期
  const data: TokenData = { access_token: token, expires_at };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data), 'utf-8');
}

// 获取新的 access_token
async function fetchAccessToken(): Promise<TokenData> {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${APP_SECRET}`;
  try {
    const res = await axios.get(url);
    if (res.data.access_token) {
      writeTokenFile(res.data.access_token, res.data.expires_in);
      log('info', 'Fetched new access_token');
      return {
        access_token: res.data.access_token,
        expires_at: Math.floor(Date.now() / 1000) + res.data.expires_in - 60
      };
    } else {
      log('error', 'Failed to fetch access_token', res.data);
      throw new Error('Failed to fetch access_token: ' + JSON.stringify(res.data));
    }
  } catch (e) {
    log('error', 'Error fetching access_token', e);
    throw e;
  }
}

// 获取可用 access_token
export async function getAccessToken(): Promise<string> {
  let tokenData = readTokenFile();
  const now = Math.floor(Date.now() / 1000);
  if (tokenData && tokenData.access_token && tokenData.expires_at > now) {
    return tokenData.access_token;
  }
  // 过期或不存在，重新获取
  tokenData = await fetchAccessToken();
  return tokenData.access_token;
} 