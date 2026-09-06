import { Droplet, TrainFront } from 'lucide-react';

/** Decorative marks: the rails and water meet, like the couple's two paths. */
export function RailWaterMotif({ className = '' }: { className?: string }) {
  return <div className={`rail-water-motif ${className}`} aria-hidden="true">
    <TrainFront className="rail-symbol" strokeWidth={1.15} />
    <svg viewBox="0 0 180 36" fill="none">
      <g stroke="var(--rail)" strokeWidth="1">
        <path d="M0 14H69M0 22H69" />
        {[8, 20, 32, 44, 56].map(x => <path key={x} d={`M${x} 10V26`} />)}
      </g>
      <circle cx="83" cy="18" r="6" stroke="var(--rail)" />
      <circle cx="91" cy="18" r="6" stroke="var(--water)" />
      <g stroke="var(--water)" strokeWidth="1">
        <path d="M105 14C118 2 130 26 143 14S168 2 180 14M105 22C118 10 130 34 143 22S168 10 180 22" />
      </g>
    </svg>
    <Droplet className="water-symbol" strokeWidth={1.15} />
  </div>;
}

export function RailwayArch() {
  return <svg className="railway-arch" viewBox="0 0 500 620" fill="none" preserveAspectRatio="none" aria-hidden="true">
    <path d="M22 600V260C22 119 119 22 250 22S478 119 478 260V600" stroke="var(--rail)" strokeWidth="24" strokeDasharray="1 16" opacity=".65" />
    <g stroke="var(--rail)" strokeWidth="1.2">
      <path d="M17 600V260C17 116 116 17 250 17S483 116 483 260V600" />
      <path d="M27 600V260C27 122 122 27 250 27S473 122 473 260V600" />
    </g>
  </svg>;
}

export function WaterRipples({ className = '' }: { className?: string }) {
  return <svg className={`water-ripples ${className}`} viewBox="0 0 220 140" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="1">
      <ellipse cx="110" cy="86" rx="98" ry="38" opacity=".4" />
      <ellipse cx="110" cy="86" rx="73" ry="27" opacity=".6" />
      <ellipse cx="110" cy="86" rx="47" ry="17" opacity=".8" />
      <ellipse cx="110" cy="86" rx="21" ry="7" />
      <path d="M110 14C106 23 100 28 100 34a10 10 0 0 0 20 0c0-6-6-11-10-20Z" />
    </g>
  </svg>;
}
