import { Plus, X } from 'lucide-react';
import { MAX_COMPANIONS, type Companion } from '../shared/validation';
import './companion-fields.css';

export type CompanionEntry = Companion & { id: number };

export function CompanionFields({ guests, onChange, disabled }: {
  guests: CompanionEntry[];
  onChange: (guests: CompanionEntry[]) => void;
  disabled: boolean;
}) {
  function update(id: number, values: Partial<Companion>) {
    onChange(guests.map(guest => guest.id === id ? { ...guest, ...values } : guest));
  }
  return <section className="companion-fields" aria-labelledby="companions-title">
    <h3 id="companions-title">ご家族・同伴者のご回答</h3>
    <p>代表者を含め10名まで まとめてご回答いただけます 連絡先とメッセージは共通です</p>
    {guests.map((guest, index) => <fieldset key={guest.id} disabled={disabled} className="companion-card">
      <legend>同伴者 {index + 1}</legend>
      <button type="button" className="text-button companion-remove" aria-label={`同伴者 ${index + 1} を削除`} onClick={() => onChange(guests.filter(item => item.id !== guest.id))}><X size={14} />削除</button>
      <div className="attendance-options">{(['attending', 'declining'] as const).map(value => <label key={value} className={`attendance-option ${guest.attendance === value ? 'selected' : ''}`}>
        <input type="radio" name={`companionAttendance-${guest.id}`} value={value} checked={guest.attendance === value} onChange={() => update(guest.id, { attendance: value, allergies: value === 'declining' ? '' : guest.allergies })} />
        <span className="radio-mark">{guest.attendance === value && <span />}</span>{value === 'attending' ? 'ご出席' : 'ご欠席'}
      </label>)}</div>
      <label className="form-field">お名前 <span className="required">必須</span><input value={guest.name} onChange={event => update(guest.id, { name: event.target.value })} placeholder="山田 太郎" maxLength={80} required /></label>
      <label className="form-field">ふりがな <span className="required">必須</span><input value={guest.kana} onChange={event => update(guest.id, { kana: event.target.value })} placeholder="やまだ たろう" maxLength={100} required /></label>
      {guest.attendance === 'attending' && <label className="form-field">アレルギー・お食事について <span className="optional">任意</span><input value={guest.allergies} onChange={event => update(guest.id, { allergies: event.target.value })} maxLength={500} placeholder="アレルギーなどがあればお知らせください" /></label>}
    </fieldset>)}
    <button type="button" className="outline-button" disabled={disabled || guests.length >= MAX_COMPANIONS} onClick={() => onChange([...guests, { id: Math.max(0, ...guests.map(guest => guest.id)) + 1, attendance: 'attending', name: '', kana: '', allergies: '' }])}><Plus size={15} />同伴者を追加</button>
    <p aria-live="polite">回答人数：{guests.length + 1}名</p>
  </section>;
}
