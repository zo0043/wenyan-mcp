import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { getAccessToken } from './wechatToken.js';

interface UploadResponse {
    type: string;
    media_id: string;
    created_at: number;
}

/**
 * 上传临时素材到微信公众号
 * @param accessToken 访问令牌
 * @param type 媒体文件类型，分别有图片（image）、语音（voice）、视频（video）和缩略图（thumb）
 * @param filePath 本地文件路径
 * @returns 上传结果
 */
export async function uploadMedia(
    _accessToken: string, // 不再直接用参数
    type: 'image' | 'voice' | 'video' | 'thumb',
    filePath: string
): Promise<UploadResponse> {
    const accessToken = await getAccessToken();
    const url = `https://api.weixin.qq.com/cgi-bin/media/upload?access_token=${accessToken}&type=${type}`;
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    // 创建 FormData
    const form = new FormData();
    form.append('media', fs.createReadStream(filePath));

    try {
        const response = await axios.post(url, form, {
            headers: {
                ...form.getHeaders()
            }
        });

        if (response.data.errcode) {
            throw new Error(`Upload failed: ${response.data.errmsg}`);
        }

        return {
            type: response.data.type,
            media_id: response.data.media_id,
            created_at: response.data.created_at
        };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`Upload failed: ${error.message}`);
        }
        throw error;
    }
}

/**
 * 获取临时素材
 * @param accessToken 访问令牌
 * @param mediaId 媒体文件ID
 * @param savePath 保存路径
 */
export async function getMedia(
    _accessToken: string, // 不再直接用参数
    mediaId: string,
    savePath: string
): Promise<void> {
    const accessToken = await getAccessToken();
    const url = `https://api.weixin.qq.com/cgi-bin/media/get?access_token=${accessToken}&media_id=${mediaId}`;
    
    try {
        const response = await axios.get(url, {
            responseType: 'stream'
        });

        // 确保目录存在
        const dir = path.dirname(savePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 保存文件
        const writer = fs.createWriteStream(savePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`Download failed: ${error.message}`);
        }
        throw error;
    }
}

/**
 * 上传永久素材到微信公众号
 * @param accessToken 访问令牌
 * @param type 媒体文件类型，分别有图片（image）、语音（voice）、视频（video）和缩略图（thumb）
 * @param filePath 本地文件路径
 * @param description 视频类型时的描述信息（JSON字符串，包含title和introduction）
 * @returns 上传结果
 */
export async function uploadPermanentMedia(
    _accessToken: string, // 不再直接用参数
    type: 'image' | 'voice' | 'video' | 'thumb',
    filePath: string,
    description?: { title: string; introduction: string }
): Promise<any> {
    const accessToken = await getAccessToken();
    const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=${type}`;

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const form = new FormData();
    form.append('media', fs.createReadStream(filePath));
    if (type === 'video' && description) {
        form.append('description', JSON.stringify(description));
    }

    try {
        const response = await axios.post(url, form, {
            headers: {
                ...form.getHeaders()
            }
        });
        if (response.data.errcode) {
            throw new Error(`Upload failed: ${response.data.errmsg}`);
        }
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`Upload failed: ${error.message}`);
        }
        throw error;
    }
} 