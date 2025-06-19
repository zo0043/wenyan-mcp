import { JSDOM } from "jsdom";
import { FormData, File } from 'formdata-node';
import { fileFromPath } from 'formdata-node/file-from-path';
import path from "path";
import { log } from './logger.js';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { getAccessToken } from './wechatToken.js';

const tokenUrl = "https://api.weixin.qq.com/cgi-bin/token";
const publishUrl = "https://api.weixin.qq.com/cgi-bin/draft/add";
const uploadUrl = `https://api.weixin.qq.com/cgi-bin/material/add_material`;
const appId = process.env.WECHAT_APP_ID || "";
const appSecret = process.env.WECHAT_APP_SECRET || "";
const hostImagePath = process.env.HOST_IMAGE_PATH || "";
const dockerImagePath = "/mnt/host-downloads";

type UploadResponse = {
    media_id: string;
    url: string
};

async function uploadMaterial(type: string, fileData: Blob | File, fileName: string, accessToken: string): Promise<UploadResponse> {
    log('info', `uploadMaterial started ${type} ${fileName} ${accessToken}`);
    const form = new FormData();
    form.append("media", fileData, fileName);
    const response = await fetch(`${uploadUrl}?access_token=${accessToken}&type=${type}`, {
        method: 'POST',
        body: form as any,
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`上传失败: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    if (data.errcode) {
        throw new Error(`上传失败，错误码：${data.errcode}，错误信息：${data.errmsg}`);
    }
    const result = data.url.replace("http://", "https://");
    data.url = result;
    return data;
}

async function saveBufferToFile(buffer: ArrayBuffer, filePath: string): Promise<void> {
    const nodeBuffer = Buffer.from(buffer);
    await fs.writeFile(filePath, nodeBuffer);
}

async function uploadImage(imageUrl: string, accessToken: string, fileName?: string): Promise<UploadResponse> {
    const imagesDir = path.resolve(process.cwd(), 'images');
    if (!existsSync(imagesDir)) {
        mkdirSync(imagesDir);
    }
    if (imageUrl.startsWith("http")) {
        const response = await fetch(imageUrl);
        if (!response.ok || !response.body) {
            throw new Error(`Failed to download image from URL: ${imageUrl}`);
        }
        const fileNameFromUrl = path.basename(imageUrl.split("?")[0]);
        const ext = path.extname(fileNameFromUrl) || '.jpg';
        const imageName = fileName ?? (ext === "" ? `${fileNameFromUrl}.jpg` : fileNameFromUrl);
        const buffer = await response.arrayBuffer();
        const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${imageName}`;
        const localImagePath = path.join(imagesDir, uniqueName);
        await saveBufferToFile(buffer, localImagePath);
        const file = await fileFromPath(localImagePath);
        return await uploadMaterial('image', file, uniqueName, accessToken);
    } else {
        const localImagePath = hostImagePath ? imageUrl.replace(hostImagePath, dockerImagePath) : imageUrl;
        const fileName = path.basename(localImagePath);
        const file = await fileFromPath(localImagePath);
        return await uploadMaterial('image', file, fileName, accessToken);
    }
}

async function uploadImages(content: string, accessToken: string): Promise<string> {
    const dom = new JSDOM(content);
    const document = dom.window.document;
    const images = Array.from(document.querySelectorAll('img'));
    const uploadPromises = images.map(async (element) => {
        const dataSrc = element.getAttribute('src');
        if (dataSrc) {
            if (!dataSrc.startsWith('https://mmbiz.qpic.cn')) {
                const resp = await uploadImage(dataSrc, accessToken);
                element.setAttribute('src', resp.url);
                return resp.media_id;
            } else {
                return dataSrc;
            }
        }
        return null;
    });

    const mediaIds = (await Promise.all(uploadPromises)).filter(Boolean);
    const firstImageId = mediaIds[0] || "";
    return firstImageId;
}

export async function publishToDraft(title: string, content: string, cover: string) {
    try {
        const accessToken = await getAccessToken();
        const firstImageId = await uploadImages(content, accessToken);
        let thumbMediaId = "";
        if (cover) {
            const resp = await uploadImage(cover, accessToken, "cover.jpg");
            thumbMediaId = resp.media_id;
        } else {
            if (firstImageId.startsWith("https://mmbiz.qpic.cn")) {
                const resp = await uploadImage(firstImageId, accessToken, "cover.jpg");
                thumbMediaId = resp.media_id;
            } else {
                thumbMediaId = firstImageId;
            }
        }
        if (!thumbMediaId) {
            throw new Error("你必须指定一张封面图或者在正文中至少出现一张图片。");
        }
        log('info', `publishToDraft started ${title} ${content} ${thumbMediaId}`);
        log('info', 'Publish to WeChat request:', {
            url: `${publishUrl}?access_token=${accessToken}`,
            body: {
                articles: [{
                    title,
                    content,
                    thumb_media_id: thumbMediaId,
                }]
            }
        });
        const response = await fetch(`${publishUrl}?access_token=${accessToken}`, {
            method: 'POST',
            body: JSON.stringify({
                articles: [{
                    title: title,
                    content: content,
                    thumb_media_id: thumbMediaId,
                }]
            })
        });
        const data = await response.json();
        if (data.media_id) {
            return data;
        } else if (data.errcode) {
            throw new Error(`上传到公众号草稿失败，错误码：${data.errcode}，${data.errmsg}`);
        } else {
            throw new Error(`上传到公众号草稿失败: ${data}`);
        }
    } catch (error) {
        log('error', 'publishToDraft error', error);
        throw error;
    }
}
