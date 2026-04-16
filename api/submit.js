/**
 * Botball Score Submission API
 * 用于接收并存储比赛计分数据
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'submissions.json');

// 确保数据目录存在
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

// 获取所有提交记录
async function getSubmissions() {
  try {
    await ensureDataDir();
    if (!existsSync(DATA_FILE)) {
      return [];
    }
    const data = await readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading submissions:', error);
    return [];
  }
}

// 保存提交记录
async function saveSubmission(submission) {
  try {
    await ensureDataDir();
    const submissions = await getSubmissions();
    
    // 添加新提交，生成唯一ID
    const newSubmission = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      ...submission,
      createdAt: new Date().toISOString()
    };
    
    submissions.push(newSubmission);
    
    await writeFile(DATA_FILE, JSON.stringify(submissions, null, 2), 'utf-8');
    
    return { success: true, id: newSubmission.id };
  } catch (error) {
    console.error('Error saving submission:', error);
    return { success: false, error: error.message };
  }
}

// CORS 头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export default async function handler(req, res) {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).set(corsHeaders).send('');
  }

  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).set(corsHeaders).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    
    // 验证必填字段
    if (!body.teamNumber || !body.fieldId) {
      return res.status(400).set(corsHeaders).json({ 
        error: 'Missing required fields: teamNumber, fieldId' 
      });
    }

    // 构建提交数据
    const submission = {
      teamNumber: String(body.teamNumber).trim(),
      fieldId: String(body.fieldId).trim().toUpperCase(),
      mode: body.mode || 'challenge',
      scoreA: body.scoreA || 0,
      scoreB: body.scoreB || 0,
      totalScore: body.totalScore || 0,
      breakdown: body.breakdown || {},
      timestamp: body.timestamp || new Date().toISOString(),
      inputData: body.inputData || {}
    };

    // 保存数据
    const result = await saveSubmission(submission);

    if (result.success) {
      console.log('Score submitted:', {
        team: submission.teamNumber,
        field: submission.fieldId,
        mode: submission.mode,
        total: submission.totalScore
      });
      
      return res.status(200).set(corsHeaders).json({
        success: true,
        message: 'Score submitted successfully',
        id: result.id
      });
    } else {
      return res.status(500).set(corsHeaders).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Submission error:', error);
    return res.status(500).set(corsHeaders).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
