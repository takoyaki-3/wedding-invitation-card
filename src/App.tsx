import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, CalendarDays, Check, ChevronRight, Clock3, Flower2, Github, Heart, Leaf, Mail, MapPin, Menu, Plus, X } from 'lucide-react';
import { responseSchema } from '../shared/validation';
import { runtimeConfigSchema, type RuntimeConfig } from '../shared/runtime-config';

const wedding = __WEDDING_CONFIG__;
const date = wedding.date ? new Date(wedding.date) : null;
const jpDate = (value: string) => value ? new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' }).format(new Date(value)) : '日時は後日ご案内';
const dateParts = date ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo' }).formatToParts(date) : [];
const part = (type: string) => dateParts.find(p => p.type === type)?.value || '—';
const weekday = date ? new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Tokyo' }).format(date) : 'COMING SOON';
const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wedding.mapQuery)}`;

function Botanical({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 150 220" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="1.1"><path d="M73 216C68 157 83 93 98 15M76 178C46 151 34 111 35 75M79 150C104 126 122 100 132 68M83 110C68 89 61 65 63 41"/>{[[73,192,-38],[74,165,32],[79,135,-35],[87,90,30],[93,56,-25],[42,111,-43],[52,140,33],[111,109,35],[122,88,-20],[65,67,-26]].map(([x,y,r], i) => <ellipse key={i} cx={x} cy={y} rx="7" ry="19" transform={`rotate(${r} ${x} ${y})`} />)}<path d="M98 31C86 15 93 4 103 2C109 13 109 21 98 31Z"/></g></svg>;
}

function App() {
  const [menu, setMenu] = useState(false);
  const [runtime, setRuntime] = useState<RuntimeConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [attendance, setAttendance] = useState<'attending' | 'declining'>('attending');
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('invite') || '');
  const resultRef = useRef<HTMLDivElement>(null);
  const deadlinePassed = Date.now() > new Date(wedding.deadline).getTime();

  useEffect(() => {
    document.title = `${wedding.groom} & ${wedding.bride} | Wedding Invitation`;
    if (window.location.hash.startsWith('#invite=')) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    fetch('/config.json', { cache: 'no-store' }).then(async res => {
      if (!res.ok) throw new Error('config');
      setRuntime(runtimeConfigSchema.parse(await res.json()));
    }).catch(() => setConfigError(true));
  }, []);

  useEffect(() => { if (submitted) resultRef.current?.focus(); }, [submitted]);

  function addToCalendar() {
    if (!wedding.date || !wedding.endDate) return;
    const utc = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const contents = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Our Wedding//JA', 'BEGIN:VEVENT', `UID:${utc(wedding.date)}@our-wedding`, `DTSTAMP:${utc(new Date().toISOString())}`, `DTSTART:${utc(wedding.date)}`, `DTEND:${utc(wedding.endDate)}`, `SUMMARY:${escape(`${wedding.groom} & ${wedding.bride} 結婚式`)}`, `LOCATION:${escape(`${wedding.venueJapanese} ${wedding.address}`)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'our-wedding.ics'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!runtime || sending) return;
    setError('');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    delete fields.attendanceChoice;
    const parsed = responseSchema.safeParse({ ...fields, attendance, allergies: attendance === 'attending' ? fields.allergies || '' : '', consent: fields.consent === 'on', token: runtime.demo ? 'd'.repeat(43) : token });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || '入力内容をご確認ください'); return; }
    setSending(true);
    try {
      if (!runtime.demo) {
        const res = await fetch(runtime.rsvpEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(15000) });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || '送信できませんでした。しばらくしてから再度お試しください。');
        }
      }
      setSubmitted(true);
    } catch (err) { setError(err instanceof Error && err.name === 'TimeoutError' ? '通信がタイムアウトしました。同じ内容でもう一度送信してください。' : err instanceof Error ? err.message : '通信に失敗しました。もう一度お試しください。'); }
    finally { setSending(false); }
  }

  const links = [['#message', 'ごあいさつ'], ['#details', '当日のご案内'], ['#access', 'アクセス']];

  return <>
    <header className="site-header">
      <a href="#" className="monogram" aria-label="ページの先頭へ">{wedding.groom[0]}<span>&</span>{wedding.bride[0]}<i>THE WEDDING</i></a>
      <nav className={menu ? 'navigation is-open' : 'navigation'} aria-label="メインナビゲーション">
        {links.map(([href, label]) => <a key={href} href={href} onClick={() => setMenu(false)}>{label}</a>)}
        <a className="nav-rsvp" href="#rsvp" onClick={() => setMenu(false)}>出欠のご回答 <ArrowRight size={14} /></a>
      </nav>
      <button className="menu-toggle" onClick={() => setMenu(!menu)} aria-label={menu ? 'メニューを閉じる' : 'メニューを開く'} aria-expanded={menu}>{menu ? <X /> : <Menu />}</button>
      <a className="github-link" href="https://github.com/takoyaki-3/wedding-invitation-card" target="_blank" rel="noopener noreferrer" aria-label="GitHubでソースコードを見る（新しいタブ）" title="GitHubでソースコードを見る"><Github size={21} strokeWidth={1.6} aria-hidden="true" /></a>
    </header>

    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow"><span /> WE ARE GETTING MARRIED</div>
          <h1 id="hero-title">Together,<br /><em>a beautiful</em><br />beginning.</h1>
          <p className="hero-japanese">大切なあなたと、はじまりの一日を。</p>
          <div className="couple-names">{wedding.groom} <span>&</span> {wedding.bride}</div>
          <div className="hero-date"><span>{date ? `${part('year')}.${part('month')}.${part('day')}` : 'Date to be announced'}</span><span className="day-label">{date ? weekday.toUpperCase() : 'OUR WEDDING'}</span></div>
          <a className="primary-button hero-button" href="#rsvp">出欠のご回答 <ArrowRight size={16} /></a>
          <p className="deadline-small">お返事は {jpDate(wedding.deadline)} まで</p>
        </div>
        <div className="hero-art">
          <div className="photo-arch"><img src="/wedding-table.jpg" alt="緑と白い花に囲まれたガーデンウェディングのテーブル" fetchPriority="high" /><div className="photo-caption">A DAY TO REMEMBER, WITH YOU.</div></div>
          <div className="wedding-seal"><Flower2 size={24} strokeWidth={1} /><span>WITH LOVE</span><strong>{wedding.groom[0]} & {wedding.bride[0]}</strong><span>{date ? `${part('month')}.${part('day')}.${part('year')}` : 'OUR WEDDING'}</span></div>
          <Botanical className="hero-botanical" />
          <span className="side-note">OUR NEXT CHAPTER STARTS HERE</span>
        </div>
        <a className="scroll-note" href="#message">SCROLL TO DISCOVER <ArrowDown size={13} /></a>
      </section>

      <div className="date-ribbon"><span>THE WEDDING OF {wedding.groom.toUpperCase()} & {wedding.bride.toUpperCase()}</span><Flower2 size={18} strokeWidth={1} /><span>{date ? `${weekday.toUpperCase()}, ${new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Tokyo' }).format(date).toUpperCase()}` : wedding.venue.toUpperCase()}</span></div>

      <section id="message" className="message-section section-anchor">
        <div className="section-kicker">01 — MESSAGE</div>
        <h2>With all our hearts.</h2><p className="section-subtitle">大切な皆さまへ</p>
        <div className="message-body"><p>これまで私たちを支えてくださった皆さまへ<br />感謝の気持ちを込めて<br />結婚式を挙げることになりました</p><p>いつもそばにいてくれたあなたと<br />笑顔あふれる あたたかなひとときを<br />一緒に過ごせたら幸せです</p><p>おいそがしい中とは存じますが<br />ぜひ私たちの新しい門出を見届けてください</p></div>
        <div className="japanese-names">{wedding.groomJapanese}<span>&</span>{wedding.brideJapanese}</div>
        <Botanical className="message-botanical" />
      </section>

      <section id="details" className="details-section section-anchor">
        <div className="section-heading"><div><div className="section-kicker">02 — WEDDING DAY</div><h2>A day full of love.</h2><p className="section-subtitle">当日のご案内</p></div>{date && wedding.endDate && <button className="text-button" onClick={addToCalendar}><Plus size={15} /> カレンダーに追加</button>}</div>
        <div className="event-date"><CalendarDays size={19} strokeWidth={1.4} /><span>{jpDate(wedding.date)}{date && <small>（{new Intl.DateTimeFormat('ja-JP', { weekday: 'short', timeZone: 'Asia/Tokyo' }).format(date)}）</small>}</span></div>
        <div className="schedule-grid">
          {[{ icon: <Mail />, en: 'Welcome', ja: '受付', time: wedding.receptionTime, text: 'お時間に余裕をもってお越しください' }, { icon: <Heart />, en: 'Ceremony', ja: '挙式', time: wedding.ceremonyTime, text: '皆さまの前で 永遠の愛を誓います' }, { icon: <Flower2 />, en: 'Reception', ja: '披露宴', time: wedding.partyTime, text: 'お食事と会話を ゆっくりお楽しみください' }].map((item, i) => <article className="schedule-card" key={item.en}><span className="schedule-number">0{i + 1}</span><div className="schedule-icon">{item.icon}</div><h3>{item.en}</h3><span className="schedule-ja">{item.ja}</span><div className={`schedule-time ${item.time.includes(':') ? '' : 'time-pending'}`}>{item.time}</div><p>{item.text}</p></article>)}
        </div>
      </section>

      <section id="access" className="access-section section-anchor">
        <div className="venue-photo"><img src="/wedding-venue.jpg" loading="lazy" alt="光が差し込むウェディング会場のイメージ" /><span>THE PLACE WHERE WE SAY “I DO”</span></div>
        <div className="venue-copy"><div className="section-kicker">03 — LOCATION</div><h2>See you here.</h2><p className="section-subtitle">会場へのアクセス</p><h3>{wedding.venue}</h3><p className="venue-japanese">{wedding.venueJapanese}</p><div className="address-row"><MapPin size={18} /><p>{wedding.address}</p></div><div className="address-row"><Clock3 size={17} /><p>{wedding.access}</p></div><a className="outline-button" href={mapUrl} target="_blank" rel="noreferrer">Google マップで見る <ArrowRight size={15} /></a><p className="venue-note">会場写真はイメージです</p></div>
      </section>

      <section id="rsvp" className="rsvp-section section-anchor">
        <div className="rsvp-intro"><div className="section-kicker">04 — RSVP</div><h2>Will you join us?</h2><p className="section-subtitle">出欠のご回答</p><p className="rsvp-description">お会いできる日を 心より楽しみにしています。<br />下記のフォームよりご回答をお願いいたします。</p><div className="reply-by"><CalendarDays size={18} strokeWidth={1.3} /><div><span>PLEASE REPLY BY</span><p>{jpDate(wedding.deadline)}</p></div></div><Leaf className="rsvp-leaf" size={62} strokeWidth={0.7} /></div>
        <div className="rsvp-panel">
          {submitted ? <div className="success-state" ref={resultRef} tabIndex={-1}><div className="success-icon"><Check size={30} strokeWidth={1.2} /></div><span className="section-kicker">THANK YOU</span><h3>{runtime?.demo ? 'ご回答のプレビューが完了しました' : 'ご回答ありがとうございます'}</h3><p>{runtime?.demo ? 'これはデモのため、出欠の登録・メール送信は行われていません。' : '出欠のご回答を受け付けました。メールアドレスをご登録の方には、回答のコピーを順次お送りします。'}<br />{attendance === 'attending' ? '当日お会いできることを楽しみにしています。' : 'あたたかなお気持ちをありがとうございます。'}</p>{runtime?.demo && <button className="text-button" onClick={() => setSubmitted(false)}>フォームに戻る <ArrowRight size={15} /></button>}</div> : <form onSubmit={submit}>
            {runtime?.demo && <p className="demo-notice">プレビュー版：回答は保存されず、メールも送信されません。</p>}
            {configError && <p className="form-error" role="alert">設定を読み込めませんでした。ページを再読み込みしてください。</p>}
            {runtime && !runtime.demo && !token && <p className="form-error" role="alert">ご回答には、お送りした専用の招待リンクからアクセスしてください。</p>}
            {deadlinePassed && <p className="form-error">回答期限を過ぎています。新郎新婦へ直接ご連絡ください。</p>}
            <fieldset disabled={sending || deadlinePassed}><legend>ご出席について <span className="required">必須</span></legend><div className="attendance-options">{(['attending', 'declining'] as const).map(value => <label key={value} className={`attendance-option ${attendance === value ? 'selected' : ''}`}><input type="radio" name="attendanceChoice" value={value} checked={attendance === value} onChange={() => setAttendance(value)} /><span className="radio-mark">{attendance === value && <span />}</span>{value === 'attending' ? 'ご出席' : 'ご欠席'}<span className="attendance-en">{value === 'attending' ? 'Joyfully accepts' : 'Regretfully declines'}</span></label>)}</div></fieldset>
            <div className="form-grid"><label>お名前 <span className="required">必須</span><input name="name" autoComplete="name" placeholder="山田 花子" maxLength={80} required disabled={sending} /></label><label>ふりがな <span className="required">必須</span><input name="kana" placeholder="やまだ はなこ" maxLength={100} required disabled={sending} /></label></div>
            <label className="form-field">メールアドレス <span className="optional">任意</span><input name="email" type="email" autoComplete="email" placeholder="hanako@example.com" maxLength={254} disabled={sending} /><small>ご入力いただいた方に、回答のコピーをメールでお送りします。</small></label>
            {attendance === 'attending' && <label className="form-field">アレルギー・お食事について <span className="optional">任意</span><input name="allergies" placeholder="お持ちのアレルギーなどがあればお知らせください" maxLength={500} disabled={sending} /></label>}
            <label className="form-field">おふたりへのメッセージ <span className="optional">任意</span><textarea name="message" rows={3} placeholder="お祝いのメッセージなど ご自由にお書きください" maxLength={1000} disabled={sending} /></label>
            <div className="honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
            <label className="consent"><input name="consent" type="checkbox" required disabled={sending} /><span>ご入力いただいた情報を、結婚式の出欠確認・ご連絡・お食事の手配に利用することに同意します。</span></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button submit-button" type="submit" disabled={sending || !runtime || deadlinePassed || (!runtime.demo && !token)}>{sending ? '送信しています…' : runtime?.demo ? '回答をプレビューする' : 'この内容で回答する'}<ArrowRight size={16} /></button>
            <p className="form-footnote"><Mail size={12} /> メールアドレスをご登録の方に回答のコピーをお送りします</p>
          </form>}
        </div>
      </section>

      <section className="closing"><Flower2 size={28} strokeWidth={0.8} /><p>We can't wait to celebrate with you.</p><span>あなたと過ごす 特別な一日を楽しみに。</span></section>
    </main>
    <footer><a href="#" className="footer-names">{wedding.groom} <em>&</em> {wedding.bride}</a><span>WITH LOVE, ALWAYS.</span><a href={`mailto:${wedding.contactEmail}`}>お問い合わせ <ChevronRight size={12} /></a></footer>
  </>;
}

export default App;
