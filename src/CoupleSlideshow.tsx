import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

declare const __COUPLE_PHOTOS__: string[];
const photos = __COUPLE_PHOTOS__;

export function CoupleSlideshow() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!section.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(section.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (photos.length < 2 || paused || hovered || !visible) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex(current => (current + 1) % photos.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [paused, hovered, visible]);

  useEffect(() => {
    if (!visible || photos.length < 2) return;
    const next = new Image();
    next.src = photos[(index + 1) % photos.length];
  }, [index, visible]);

  if (!photos.length) return null;

  function move(step: number) {
    setPaused(true);
    setIndex(current => (current + step + photos.length) % photos.length);
  }

  return <section ref={section} className="couple-gallery" aria-label="ふたりの写真" aria-roledescription="カルーセル"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={event => {
      if (!(event.target as HTMLElement).closest('.photo-playback')) setPaused(true);
    }}>
    <div className="couple-photo-frame" aria-live={paused ? 'polite' : 'off'}>
      <img key={photos[index]} src={photos[index]} alt={`ふたりのツーショット写真 ${index + 1}`} loading="eager" fetchPriority={index === 0 ? 'high' : 'auto'} decoding="async" />
    </div>
    {photos.length > 1 && <div className="photo-controls">
      <button type="button" onClick={() => move(-1)} aria-label="前の写真"><ChevronLeft size={18} /></button>
      <span className="photo-counter">{String(index + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}</span>
      <button type="button" onClick={() => move(1)} aria-label="次の写真"><ChevronRight size={18} /></button>
      <button type="button" className="photo-playback" onClick={() => setPaused(value => !value)} aria-label={paused ? 'スライドショーを再生' : 'スライドショーを一時停止'}>
        {paused ? <Play size={15} /> : <Pause size={15} />}<span>{paused ? '再生' : '一時停止'}</span>
      </button>
    </div>}
  </section>;
}
