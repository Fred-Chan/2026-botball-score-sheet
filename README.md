# 2026 Botball Score Sheet

Static score sheet with a Vercel Serverless endpoint for submitting score records and screenshots to Feishu Base.

## Feishu Submission

Set these Vercel environment variables before deploying:

| Variable | Required | Description |
| --- | --- | --- |
| `FEISHU_APP_ID` or `LARK_APP_ID` | Yes | Feishu/Lark app ID. |
| `FEISHU_APP_SECRET` or `LARK_APP_SECRET` | Yes | Feishu/Lark app secret. |
| `FEISHU_BASE_TOKEN` or `LARK_BASE_TOKEN` | Yes | Base token, for example `app_xxx`. |
| `FEISHU_TABLE_ID` or `LARK_TABLE_ID` | Yes | Target table ID, for example `tbl_xxx`. |
| `FEISHU_SCREENSHOT_FIELD` or `LARK_SCREENSHOT_FIELD` | Yes | Attachment field ID or name for the score screenshot. |
| `FEISHU_SUBMITTED_AT_FIELD` | No | Date/time field for submit time. |
| `FEISHU_MODE_FIELD` | No | Text or select field for competition mode. |
| `FEISHU_CURRENT_FIELD_FIELD` | No | Text or select field for the currently edited field. |
| `FEISHU_TOTAL_SCORE_FIELD` | No | Number field for total score. |
| `FEISHU_SCORE_A_FIELD` | No | Number field for Field A score. |
| `FEISHU_SCORE_B_FIELD` | No | Number field for Field B score. |
| `FEISHU_PAYLOAD_FIELD` | No | Text field for raw score JSON. |
| `FEISHU_STATIC_FIELDS_JSON` | No | JSON object merged into every submitted record. |
| `FEISHU_API_BASE` | No | Defaults to `https://open.feishu.cn/open-apis`. |

The Feishu app needs permissions for creating/updating Base records, reading fields, and uploading Drive media.
