/**
 * Botball Score Submission API
 * Vercel Serverless Function - 飞书多维表中转
 */

// 飞书配置
const LARK_APP_ID = process.env.LARK_APP_ID;
const LARK_APP_SECRET = process.env.LARK_APP_SECRET;
const BITABLE_APP_TOKEN = 'LAAObAgWSacPntsxGwdc0XQun7e';
const TABLE_ID = 'tbl4S19o3FqgayBZ';

// 字段ID映射
const FIELD_IDS = {
  teamNumber: 'fldTnvg5VL',    // 队伍编号
  fieldId: 'fldzFtEdin',       // 赛台
  mode: 'fldrbZxJ64',          // 比赛模式
  scoreA: 'fldV0BuTVr',        // A场地分数
  scoreB: 'fldqyfM7No',        // B场地分数
  totalScore: 'fldUZH9sSv',    // 总分
  timestamp: 'fldLwzMCeR'      // 提交时间
};

// 缓存 tenant_access_token
let cachedToken = null;
let tokenExpireTime = 0;

/**
 * 获取飞书 tenant_access_token
 */
async function getTenantAccessToken() {
  // 检查缓存
  if (cachedToken && Date.now() < tokenExpireTime) {
    return cachedToken;
  }

  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: LARK_APP_ID,
      app_secret: LARK_APP_SECRET
    })
  });

  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(`获取飞书Token失败: ${data.msg}`);
  }

  cachedToken = data.tenant_access_token;
  // 提前5分钟过期
  tokenExpireTime = Date.now() + (data.expire - 300) * 1000;
  
  return cachedToken;
}

/**
 * 创建飞书多维表记录
 */
async function createBitableRecord(record) {
  const token = await getTenantAccessToken();
  
  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${TABLE_ID}/records`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          [FIELD_IDS.teamNumber]: record.teamNumber,
          [FIELD_IDS.fieldId]: record.fieldId,
          [FIELD_IDS.mode]: record.mode,
          [FIELD_IDS.scoreA]: record.scoreA,
          [FIELD_IDS.scoreB]: record.scoreB,
          [FIELD_IDS.totalScore]: record.totalScore,
          [FIELD_IDS.timestamp]: record.timestamp
        }
      })
    }
  );

  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(`创建记录失败: ${data.msg}`);
  }

  return data.data;
}

export default async function handler(req, res) {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET 请求 - 返回状态
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'ok',
      message: 'Botball Score API - 使用飞书多维表存储'
    });
  }

  // POST 请求 - 提交成绩
  if (req.method === 'POST') {
    try {
      const body = req.body;
      
      // 验证必填字段
      if (!body || !body.teamNumber) {
        return res.status(400).json({ 
          success: false,
          error: '缺少必填字段: teamNumber' 
        });
      }

      // 构建记录数据
      const record = {
        teamNumber: String(body.teamNumber).trim(),
        fieldId: String(body.fieldId || '').trim().toUpperCase(),
        mode: body.mode || 'challenge',
        scoreA: parseInt(body.scoreA) || 0,
        scoreB: parseInt(body.scoreB) || 0,
        totalScore: parseInt(body.totalScore) || 0,
        timestamp: body.timestamp || new Date().toISOString()
      };

      // 创建飞书多维表记录
      const result = await createBitableRecord(record);
      
      console.log('记录已保存到飞书多维表:', result.record_id);

      return res.status(200).json({ 
        success: true, 
        recordId: result.record_id,
        message: '提交成功'
      });
    } catch (error) {
      console.error('提交失败:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  // 其他方法不允许
  return res.status(405).json({ error: 'Method not allowed' });
}
