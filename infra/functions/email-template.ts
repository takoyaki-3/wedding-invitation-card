import type { WeddingConfig } from '../../shared/wedding';

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const multiline = (value: string) => escape(value).replace(/\r\n|\r|\n/g, '<br>');

/** Inline styles and presentation tables keep the layout usable in email clients. */
export function renderEmail(wedding: WeddingConfig, body: string, guest: boolean) {
  const lines = body.split('\n');
  const detailStart = lines.findIndex(line => line.startsWith('ご出欠：'));
  // Escape all text, including guest-entered names and messages, before rendering.
  const header = guest ? 'Thank you for your reply.' : 'A reply has arrived.';
  const intro = lines.slice(0, detailStart).join('\n').trim();
  const content = lines.slice(detailStart).join('\n');
  return `<!doctype html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${guest ? '出欠回答を受け付けました' : '新しい出欠回答が届きました'}</title></head>
<body style="margin:0;padding:0;background-color:#f3f3ec;color:#35483a;font-family:'Yu Gothic','Hiragino Kaku Gothic ProN',Meiryo,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${guest ? '出欠のご回答ありがとうございます。お送りいただいた内容をご確認ください。' : '新しい出欠回答を受け付けました。回答内容をお知らせします。'}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3f3ec"><tr><td align="center" style="padding:28px 12px;">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;border:1px solid #dce1d3;background-color:#fffef9;">
<tr><td align="center" bgcolor="#435c49" style="padding:32px 20px;color:#fffef9;">
<p style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:4px;">${escape(wedding.groom[0])} &amp; ${escape(wedding.bride[0])}</p>
<p style="margin:0;font-size:10px;letter-spacing:3px;">OUR WEDDING · RSVP</p></td></tr>
<tr><td style="padding:30px 24px 20px;">
<h1 style="margin:0 0 14px;color:#435c49;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:normal;line-height:1.3;">${header}</h1>
<p style="margin:0;color:#35483a;font-size:14px;line-height:1.9;overflow-wrap:anywhere;word-break:break-word;">${multiline(intro)}</p>
</td></tr>
<tr><td style="padding:0 24px 28px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eef0e5" style="border-top:2px solid #97a389;">
<tr><td style="padding:20px;">
<p style="margin:0 0 14px;font-size:11px;letter-spacing:2px;color:#526447;">${guest ? 'YOUR REPLY ／ ご回答内容' : 'NEW REPLY ／ 受付内容'}</p>
<p style="margin:0;font-size:14px;line-height:2;color:#35483a;overflow-wrap:anywhere;word-break:break-word;">${multiline(content)}</p>
</td></tr></table></td></tr>
<tr><td align="center" style="padding:22px 24px;border-top:1px solid #dce1d3;">
<p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:19px;color:#435c49;">${escape(wedding.groom)} &amp; ${escape(wedding.bride)}</p>
<p style="margin:0;font-size:11px;line-height:1.8;color:#5c6856;">${guest ? '変更・お問い合わせは、このメールにご返信ください。' : 'このメールは出欠回答の受付通知です。'}<br>${escape(wedding.contactEmail)}</p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
