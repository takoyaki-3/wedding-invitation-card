import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadEnvironment } from '../config/environment';
import { gatheringFromSearch, type GuestGroup } from '../shared/invitation';

const { wedding: w } = loadEnvironment();
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const dateLabel = (value: string) => value ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'full', timeZone: 'Asia/Tokyo' }).format(new Date(value)) : '日時は後日ご案内';
const logo = readFileSync(new URL('../public/logo-monochrome.svg', import.meta.url)).toString('base64');
const border = readFileSync(new URL('../public/rail-water-border.svg', import.meta.url)).toString('base64');
const output = new URL('../public/invitation/', import.meta.url);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined });
try {
  for (const group of ['friend', 'family'] as GuestGroup[]) {
    const gathering = gatheringFromSearch(`?group=${group}`);
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>Wedding Invitation</title><style>
      @page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;color:#435c49;background:#f8f7f2;font-family:'Yu Mincho','Noto Serif CJK JP','MS Mincho',serif}
      main{width:210mm;height:297mm;padding:12mm 20mm 20mm;position:relative;text-align:center;isolation:isolate}
      .border-art{position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none}
      .logo{display:block;width:15mm;height:15mm;margin:0 auto} .eyebrow{font:8pt Georgia,serif;letter-spacing:2.6pt;margin:1.5mm 0;color:#719b9f}
      h1{font:italic 28pt Georgia,serif;margin:1.5mm 0 2mm}.names{font:19pt Georgia,serif;margin:0 0 2mm}.jp-names{font-size:12pt;letter-spacing:2pt;margin:0}
      .message{font-size:10pt;line-height:1.7;margin:2.5mm 0}.message p{margin:0 0 .8mm}
      .ceremony-invitation{font-size:9pt;line-height:1.7;margin:2mm 0}.ceremony-invitation p{margin:1mm 0}
      .details{border-top:1px solid #c6cebf;border-bottom:1px solid #c6cebf;padding:3mm 0;margin-top:3mm}
      h2{font-size:14pt;font-weight:normal;margin:0 0 2mm}.schedule{display:grid;grid-template-columns:repeat(4,1fr);font-size:10pt;line-height:1.6}.schedule>div{position:relative;padding-top:4mm}.schedule>div:before{content:'';position:absolute;left:0;right:0;top:1mm;border-top:1px solid #719b9f}.schedule>div:first-child:before{left:50%}.schedule>div:last-child:before{right:50%}.schedule>div:after{content:'';position:absolute;left:calc(50% - .9mm);top:.15mm;width:1.8mm;height:1.8mm;border:1px solid #435c49;border-radius:50%;background:#f8f7f2}.schedule strong{font-size:14pt;font-weight:normal}
      .venue{font-size:12pt;margin:2mm 0 1mm}.address,.access{font-size:9pt;line-height:1.6;margin:1mm 0;white-space:pre-line}
      .reply{font-size:10pt;line-height:1.7;margin:3mm 0 0}.contact{font-size:9pt;margin:2mm 0 0}a{color:inherit;text-decoration:none}.closing{font:italic 12pt Georgia,serif;margin:2mm 0 0;color:#719b9f}
    </style></head><body><main>
      <img class="border-art" src="data:image/svg+xml;base64,${border}" alt="">
      <img class="logo" src="data:image/svg+xml;base64,${logo}" alt="Y & S">
      <p class="eyebrow">WE ARE GETTING MARRIED</p><h1>Wedding Invitation</h1>
      <p class="names">${escape(w.groom)} &amp; ${escape(w.bride)}</p>
      <div class="message"><p>皆様にはおすこやかにお過ごしのことと<br>お慶び申し上げます</p>
      <p>このたび　私たちは<br>結婚式を挙げることになりました</p>
      <p>つきましては日頃のご厚誼を感謝するとともに<br>末永いおつきあいをお願いいたしたく<br>ささやかながら披露の小宴を催したいと存じます</p>
      <p>ご多用中とは存じますが<br>ご出席くださいますようご案内申し上げます</p>
      <p>2026年10月吉日</p></div>
      <p class="jp-names">${escape(w.groomJapanese)} &amp; ${escape(w.brideJapanese)}</p>
      <div class="ceremony-invitation"><p>誠に恐縮でございますが 挙式にもご参列賜りたく<br>当日は ${escape(gathering.time)} までに ${escape(w.venueJapanese)} ${escape(gathering.place)} に<br>お越しくださいますようお願い申し上げます</p>
      <p>尚 クロークは3階 着替室は4階にございます</p></div>
      <section class="details"><h2>${escape(dateLabel(w.date))}</h2>
      <div class="schedule"><div>集合<br><strong>${escape(gathering.time)}</strong><br>${escape(gathering.place)}</div><div>挙式<br><strong>${escape(w.ceremonyTime)}</strong></div><div>受付<br><strong>13:00</strong><br>3階</div><div>披露宴<br><strong>${escape(w.partyTime)}</strong></div></div>
      <p class="address">${escape(gathering.place)}にお集まりください。なお、受付は挙式後・披露宴前に行います。。</p>
      <p class="venue">${escape(w.venueJapanese)}</p><p class="address">${escape(w.venue)}<br>${escape(w.address)}<br>電話：03-3980-1111</p><p class="access">${escape(w.access)}</p>
      <p class="address"><a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(w.mapQuery)}">会場の地図をGoogle マップで見る</a></p></section>
      <p class="reply">お手数ですが ${escape(dateLabel(w.deadline))} までに<br>お送りしたWeb招待状のフォームより<br>出欠をお知らせくださいますようお願いいたします</p>
      <p class="contact">お問い合わせ：<a href="mailto:${escape(w.contactEmail)}">${escape(w.contactEmail)}</a></p>
      <p class="closing">We can't wait to celebrate with you.</p>
    </main></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    const fits = await page.locator('main').evaluate(el => {
      const pageBounds = el.getBoundingClientRect();
      const styles = getComputedStyle(el);
      const contentBounds = {
        top: pageBounds.top + parseFloat(styles.paddingTop),
        bottom: pageBounds.bottom - parseFloat(styles.paddingBottom),
        left: pageBounds.left + parseFloat(styles.paddingLeft),
        right: pageBounds.right - parseFloat(styles.paddingRight),
      };
      return [...el.querySelectorAll<HTMLElement>('*:not(.border-art)')].every(child => {
        const bounds = child.getBoundingClientRect();
        return bounds.top >= contentBounds.top - 1 && bounds.bottom <= contentBounds.bottom + 1
          && bounds.left >= contentBounds.left - 1 && bounds.right <= contentBounds.right + 1;
      });
    });
    if (!fits) throw new Error(`Invitation content exceeds A4 page (${group}).`);
    await page.pdf({ path: fileURLToPath(new URL(`${group}.pdf`, output)), format: 'A4', printBackground: true, preferCSSPageSize: true });
    await page.close();
  }
  console.log('Created A4 invitation PDFs for friends and family.');
} finally {
  await browser.close();
}
