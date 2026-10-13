import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowRight, ChevronDown, Heart, UserRound } from 'lucide-react';
import './couple-profiles.css';
import photoComments from './profile-photo-comments.json';

declare const __PROFILE_PHOTOS__: Record<string, string[]>;
const comments: Record<string, string> = photoComments;
const groomTags = [
  ['温泉大好き♨', '旅行', '♨️'],
  ['理系の人集合！', '研究・学問', '🔬'],
  ['好きなことを仕事にしています', '仕事', '🚃'],
];
const brideTags = [
  ['理系の人集合！', '研究・学問', '🔬'],
  ['アニメ・漫画・ゲーム大好き', 'ゲーム', '🎮'],
  ['旅行好き', '旅行', '🏝️'],
];

const wedding = __WEDDING_CONFIG__;
const groomDetails = [
  { title: '基本情報', rows: [['年齢', '27歳'], ['血液型', 'A型'], ['出身地', '日本・神奈川']] },
  { title: '学歴・職種・外見', rows: [['学歴', '大学卒'], ['学校名', '調布にある国立大学'], ['職種', 'IT関連'], ['身長', '172cm']] },
  { title: '性格・趣味・生活', rows: [['性格・タイプ', '知的 好奇心旺盛 面白い 真面目'], ['お酒', 'ときどき飲む']] },
];
const brideDetails = [
  { title: '基本情報', rows: [['年齢', '27歳'], ['血液型', 'A型'], ['出身地', '東京']] },
  { title: '学歴・職種・外見', rows: [['職種', '会社員'], ['身長', '155cm']] },
  { title: '性格・趣味・生活', rows: [['性格・タイプ', '真面目 誠実 マイペース'], ['好きなこと・趣味', '旅行 自然 ゲーム・漫画']] },
];
const profiles = [
  {
    id: 'groom', role: '新郎', name: wedding.groomJapanese, englishName: wedding.groom, occupation: '鉄道関係の仕事', online: true,
    interest: '鉄道', interestLabel: '仕事',
    introduction: [
      'たこやきです 目に留めてくださりありがとうございますm(_ _)m\n同期がチラホラ結婚し始めて 結婚したいなら行動しないとな…と始めました',
      '・仕事\n鉄道会社のIT部門で働いています 仕事以外でも 趣味で友人とアプリ作ってコンテストに応募するのが好きです！ITで交通を良くしたいです',
      '・休日\n土日休みです 平日も夜なら比較的あいてます',
      '・休日の過ごし方\n鉄道で自然や温泉のある所へ旅行したり パソコンで何か作ったりしてます',
      '・性格\n夏休みに韓国のソウルから飛行機・新幹線に乗らずに東京まで帰るなど おたく気質です 同期の着せ替え人形になるなどの変わったイベントも好きです！',
      '・マイブーム\n実験道具でプリン作ったり バニラアイスや白玉作ったりと カンタンなお菓子作りにハマってます！ただ いつまで続くかな…',
      '結婚式で皆さまにお会いできることを楽しみにしています\nどうぞよろしくお願いします',
    ],
  },
  {
    id: 'bride', role: '新婦', name: wedding.brideJapanese, englishName: wedding.bride, occupation: '生物系の研究開発（水関係）', online: false,
    interest: '旅行好き', interestLabel: '旅行',
    introduction: [
      'はじめまして\nプロフィールをご覧いただきありがとうございます',
      '・仕事\n生物系の研究開発に携わっています 土日休みで 土日は出かけるか ゴロゴロしているかの両極端です 2日のうち1日は休んでいることが多いです',
      '・趣味\n漫画：通勤時間の楽しみです！\nアニメ：原画集や背景画集など見るのが好きです\nゲーム：最近モンハンをプレイしています モンスターを狩っているのか モンスターに狩られているのか怪しいです…\n資格：気が向いたら…一緒に取り組めたら嬉しいです！\n旅行：47都道府県制覇\n寺社仏閣⛩やお城🏯 景色がいいところなどいくことが多いです',
      '結婚式で皆さまにお会いできることを楽しみにしています\nどうぞよろしくお願いします',
    ],
  },
];

export function CoupleProfiles() {
  const [selected, setSelected] = useState('groom');
  const [liked, setLiked] = useState<string[]>([]);
  const [liking, setLiking] = useState(false);
  const likeLock = useRef(false);
  const [announcement, setAnnouncement] = useState('');
  const [drag, setDrag] = useState(0);
  const [photoIndices, setPhotoIndices] = useState<Record<string, number>>({});
  const suppressPhotoClick = useRef(false);
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const profile = profiles.find(item => item.id === selected)!;
  const tags = profile.id === 'bride' ? brideTags : groomTags;
  const photos = __PROFILE_PHOTOS__[selected] || [];
  const photoIndex = (photoIndices[selected] || 0) % (photos.length || 1);
  const photo = photos[photoIndex];
  const comment = photo ? comments[decodeURIComponent(photo.split('/').pop()!)] || '' : '';
  function nextPhoto() {
    if (photos.length < 2) return;
    setPhotoIndices(current => ({ ...current, [selected]: (photoIndex + 1) % photos.length }));
  }
  const details = profile.id === 'bride' ? brideDetails : groomDetails;

  useEffect(() => {
    if (!liking) return;
    const timer = window.setTimeout(() => {
      const nextProfile = profiles.find(item => item.id !== selected)!;
      setSelected(nextProfile.id);
      setAnnouncement(`${nextProfile.role}のプロフィールを表示しています`);
      setLiking(false);
      likeLock.current = false;
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 950);
    return () => window.clearTimeout(timer);
  }, [liking, selected]);

  function next(like = false) {
    if (likeLock.current) return;
    if (like) {
      likeLock.current = true;
      setLiked(current => current.includes(selected) ? current : [...current, selected]);
      setAnnouncement(`${profile.role}にいいねしました`);
      setDrag(0);
      setLiking(true);
      return;
    }
    const nextProfile = profiles.find(item => item.id !== selected)!;
    setAnnouncement(`${like ? `${profile.role}にいいねしました` : ''}${nextProfile.role}のプロフィールを表示しています`);
    setSelected(nextProfile.id);
    setDrag(0);
  }

  function finishSwipe(event: PointerEvent<HTMLButtonElement>) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    gesture.current = null;
    setDrag(0);
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    suppressPhotoClick.current = Math.abs(dx) > 10 || Math.abs(dy) > 10;
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5) next();
  }

  return <section id="profiles" className="couple-profiles section-anchor" aria-labelledby="profiles-title">
    <div className="profiles-heading">
      <div className="section-kicker">MEET THE TWO OF US</div>
      <h2 id="profiles-title">Our profiles</h2>
      <p className="section-subtitle">ふたりのプロフィール</p>
    </div>
    <details className="profiles-disclosure">
      <summary className="profiles-toggle">
        <span className="profiles-toggle-closed">ふたりのプロフィールを見る</span>
        <span className="profiles-toggle-open">プロフィールを閉じる</span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
    <div className="profiles-switch" aria-label="プロフィールの切り替え">
      {profiles.map(item => <button key={item.id} type="button" disabled={liking} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setAnnouncement(`${item.role}のプロフィールを表示しています`); }}>
        <span>{item.role}</span>{item.englishName}
      </button>)}
    </div>
    <p className="profile-announcement" role="status">{announcement}</p>
    <div className="profile-layout">
      <article className={`profile-identity profile-card profile-${profile.id}`} aria-label={`${profile.role}のプロフィール`}>
        <button type="button" disabled={liking} className="profile-portrait" aria-label={`${profile.role}の写真 ${photoIndex + 1}/${photos.length || 1}${photos.length > 1 ? '：タップで次の写真' : ''}`} style={{ transform: `translateX(${drag}px) rotate(${drag / 20}deg)` }}
          onClick={event => { if (event.detail === 0 || !suppressPhotoClick.current) nextPhoto(); suppressPhotoClick.current = false; }}
          onPointerDown={event => {
            if (!event.isPrimary || event.button !== 0) return;
            suppressPhotoClick.current = false;
            gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            const start = gesture.current;
            if (!start || start.id !== event.pointerId) return;
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            setDrag(Math.abs(dx) > Math.abs(dy) * 1.5 ? Math.max(-90, Math.min(90, dx)) : 0);
          }}
          onPointerUp={finishSwipe}
          onPointerCancel={() => { gesture.current = null; suppressPhotoClick.current = true; setDrag(0); }}
          onLostPointerCapture={() => { gesture.current = null; setDrag(0); }}>
          <span className="profile-role">{profile.role}のプロフィール</span>
          {photo ? <img className="profile-photo" src={photo} alt={`${profile.role}の写真：${comment}`} draggable={false} loading="lazy" /> : <><UserRound size={88} strokeWidth={1} aria-hidden="true" /><span className="profile-monogram">{profile.englishName}</span></>}
          {photo && <><span className="profile-photo-count">{photoIndex + 1} / {photos.length}</span><span className="profile-photo-caption">{comment}</span><span className="profile-photo-progress" aria-hidden="true">{photos.map((src, index) => <span key={src} className={index === photoIndex ? 'is-current' : ''} />)}</span></>}
          {liking && <span className="profile-like-celebration" aria-hidden="true"><span className="profile-like-ring" /><Heart className="profile-like-heart" size={80} fill="currentColor" strokeWidth={1} />{[0, 1, 2, 3, 4, 5].map(index => <Heart key={index} className={`profile-heart-particle particle-${index}`} size={20} fill="currentColor" />)}<strong>いいね！</strong><span>いいねを送りました</span></span>}
        </button>
        <div className="profile-identity-copy">
          <h3>{profile.name}</h3>
          <p>{profile.englishName}</p>
          <span className={`profile-presence ${profile.online ? 'is-online' : 'is-offline'}`} title="プロフィール演出用のステータス"><span aria-hidden="true" />{profile.online ? 'オンライン' : 'オフライン'}</span>
          <span className="profile-wedding-label"><Heart size={14} aria-hidden="true" /> Wedding profile</span>
          <div className="profile-actions">
            <button type="button" className="profile-like" disabled={liking} onClick={() => next(true)}><Heart size={18} fill={liked.includes(selected) ? 'currentColor' : 'none'} aria-hidden="true" />{liking ? 'いいねしました！' : liked.includes(selected) ? 'いいね済み・次へ' : 'いいね！'}</button>
            <button type="button" className="profile-next" disabled={liking} onClick={() => next()} aria-label="次の人を表示"><ArrowRight size={20} aria-hidden="true" /></button>
          </div>
          <p className="profile-swipe-hint">{photos.length > 1 && <>タップで次の写真へ<br /></>}左右にスワイプして次の人へ</p>
        </div>
      </article>
      <div className="profile-content">
        <section className="profile-card profile-tags" aria-label="マイタグ">
          <h3>マイタグ</h3>
          <ul>{tags.map(([label, category, emoji]) => <li key={label}><span className="profile-tag-icon" aria-hidden="true">{emoji}</span><div><h4>{label}</h4><p>{category}</p></div></li>)}</ul>
        </section>
        <section className="profile-card profile-introduction">
          <h3>自己紹介</h3>
          {profile.introduction.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </section>
        <section className="profile-card profile-basics">
          <h3>プロフィール</h3>
          {details.map(group => <div className="profile-detail-group" key={group.title}>
            <h4>{group.title}</h4>
            <dl>{group.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          </div>)}
        </section>
      </div>
    </div>
    </details>
  </section>;
}
