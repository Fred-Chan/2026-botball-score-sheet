const FEISHU_API_BASE = process.env.FEISHU_API_BASE || 'https://open.feishu.cn/open-apis';

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing environment variable: ${name}`);
    }
    return value;
}

function requireAnyEnv(names) {
    for (const name of names) {
        const value = process.env[name];
        if (value) {
            return value;
        }
    }

    throw new Error(`Missing environment variable: ${names.join(' or ')}`);
}

function formatFeishuDate(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join('-') + ' ' + [
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds())
    ].join(':');
}

function normalizeRequestBody(body) {
    if (typeof body === 'string') {
        return JSON.parse(body);
    }

    return body || {};
}

async function readJsonResponse(response) {
    const text = await response.text();
    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`Feishu returned a non-JSON response: ${text.slice(0, 200)}`);
    }
}

function assertFeishuOk(result, action) {
    if (result.code && result.code !== 0) {
        throw new Error(`${action} failed: ${result.msg || result.message || `code ${result.code}`}`);
    }

    return result.data || result;
}

async function feishuJsonRequest(path, token, options = {}) {
    const response = await fetch(`${FEISHU_API_BASE}${path}`, {
        method: options.method || 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const result = await readJsonResponse(response);
    if (!response.ok) {
        throw new Error(`${options.action || 'Feishu request'} failed: HTTP ${response.status}`);
    }

    return assertFeishuOk(result, options.action || 'Feishu request');
}

async function getTenantAccessToken() {
    const response = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            app_id: requireAnyEnv(['FEISHU_APP_ID', 'LARK_APP_ID']),
            app_secret: requireAnyEnv(['FEISHU_APP_SECRET', 'LARK_APP_SECRET'])
        })
    });

    const result = await readJsonResponse(response);
    if (!response.ok) {
        throw new Error(`Get tenant token failed: HTTP ${response.status}`);
    }

    const data = assertFeishuOk(result, 'Get tenant token');
    if (!data.tenant_access_token) {
        throw new Error('Get tenant token failed: missing tenant_access_token');
    }

    return data.tenant_access_token;
}

function buildRecordFields(payload) {
    const submittedAt = payload.submittedAt ? new Date(payload.submittedAt) : new Date();
    const fieldMap = {
        submittedAt: process.env.FEISHU_SUBMITTED_AT_FIELD,
        mode: process.env.FEISHU_MODE_FIELD,
        currentField: process.env.FEISHU_CURRENT_FIELD_FIELD,
        totalScore: process.env.FEISHU_TOTAL_SCORE_FIELD,
        scoreA: process.env.FEISHU_SCORE_A_FIELD,
        scoreB: process.env.FEISHU_SCORE_B_FIELD,
        payload: process.env.FEISHU_PAYLOAD_FIELD
    };

    const fields = {};

    if (fieldMap.submittedAt) fields[fieldMap.submittedAt] = formatFeishuDate(submittedAt);
    if (fieldMap.mode) fields[fieldMap.mode] = payload.mode === 'duel' ? '巅峰对决' : '积分挑战';
    if (fieldMap.currentField) fields[fieldMap.currentField] = payload.currentField || '';
    if (fieldMap.totalScore) fields[fieldMap.totalScore] = Number(payload.totalScore) || 0;
    if (fieldMap.scoreA) fields[fieldMap.scoreA] = Number(payload.scoreA) || 0;
    if (fieldMap.scoreB) fields[fieldMap.scoreB] = Number(payload.scoreB) || 0;
    if (fieldMap.payload) fields[fieldMap.payload] = JSON.stringify(payload.fieldData || {});

    if (process.env.FEISHU_STATIC_FIELDS_JSON) {
        Object.assign(fields, JSON.parse(process.env.FEISHU_STATIC_FIELDS_JSON));
    }

    return fields;
}

function screenshotToBuffer(dataUrl) {
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
    if (!match) {
        throw new Error('Invalid screenshot payload');
    }

    return Buffer.from(match[1], 'base64');
}

async function uploadScreenshot(token, baseToken, screenshotBuffer, fileName) {
    const formData = new FormData();
    formData.append('file_name', fileName);
    formData.append('parent_type', 'bitable_file');
    formData.append('parent_node', baseToken);
    formData.append('size', String(screenshotBuffer.length));
    formData.append('file', new Blob([screenshotBuffer], { type: 'image/png' }), fileName);

    const response = await fetch(`${FEISHU_API_BASE}/drive/v1/medias/upload_all`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`
        },
        body: formData
    });

    const result = await readJsonResponse(response);
    if (!response.ok) {
        throw new Error(`Upload screenshot failed: HTTP ${response.status}`);
    }

    const data = assertFeishuOk(result, 'Upload screenshot');
    const fileToken = data.file_token || data.file?.file_token;
    if (!fileToken) {
        throw new Error('Upload screenshot failed: missing file_token');
    }

    return {
        file_token: fileToken,
        name: fileName,
        mime_type: 'image/png',
        size: screenshotBuffer.length,
        deprecated_set_attachment: true
    };
}

function getRecordId(createResult) {
    return createResult.record_id ||
        createResult.id ||
        (createResult.record && (createResult.record.record_id || createResult.record.id));
}

function getFieldName(fieldResult) {
    return fieldResult.field_name || fieldResult.name;
}

module.exports = async function submitScore(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        response.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const baseToken = requireAnyEnv(['FEISHU_BASE_TOKEN', 'LARK_BASE_TOKEN']);
        const tableId = requireAnyEnv(['FEISHU_TABLE_ID', 'LARK_TABLE_ID']);
        const screenshotField = requireAnyEnv(['FEISHU_SCREENSHOT_FIELD', 'LARK_SCREENSHOT_FIELD']);
        const payload = normalizeRequestBody(request.body);
        const screenshotBuffer = screenshotToBuffer(payload.screenshot);

        if (screenshotBuffer.length > 20 * 1024 * 1024) {
            throw new Error('Screenshot is too large; please submit again from the score summary area');
        }

        const token = await getTenantAccessToken();
        const screenshotFieldInfo = await feishuJsonRequest(
            `/base/v3/bases/${encodeURIComponent(baseToken)}/tables/${encodeURIComponent(tableId)}/fields/${encodeURIComponent(screenshotField)}`,
            token,
            {
                action: 'Read screenshot field'
            }
        );
        const screenshotFieldName = getFieldName(screenshotFieldInfo) || screenshotField;
        const screenshotFieldType = String(screenshotFieldInfo.type || screenshotFieldInfo.field_type || '').toLowerCase();
        if (screenshotFieldType && screenshotFieldType !== 'attachment' && screenshotFieldType !== '17') {
            throw new Error(`Screenshot field must be an attachment field, got ${screenshotFieldType}`);
        }

        const fields = buildRecordFields(payload);
        const createResult = await feishuJsonRequest(
            `/base/v3/bases/${encodeURIComponent(baseToken)}/tables/${encodeURIComponent(tableId)}/records`,
            token,
            {
                method: 'POST',
                body: fields,
                action: 'Create score record'
            }
        );

        const recordId = getRecordId(createResult);
        if (!recordId) {
            throw new Error('Create score record failed: missing record id');
        }

        const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `botball-score-${safeTimestamp}.png`;
        const attachment = await uploadScreenshot(token, baseToken, screenshotBuffer, fileName);

        await feishuJsonRequest(
            `/base/v3/bases/${encodeURIComponent(baseToken)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`,
            token,
            {
                method: 'PATCH',
                body: {
                    [screenshotFieldName]: [attachment]
                },
                action: 'Attach score screenshot'
            }
        );

        response.status(200).json({
            ok: true,
            recordId,
            fileName
        });
    } catch (error) {
        response.status(500).json({
            error: error.message || 'Submit score failed'
        });
    }
};
