import { z } from 'zod';

export const MAX_COMPANIONS = 9;
export const companionSchema = z.object({
  attendance: z.enum(['attending', 'declining']),
  name: z.string().trim().min(1, '同伴者のお名前を入力してください').max(80),
  kana: z.string().trim().min(1, '同伴者のふりがなを入力してください').max(100),
  allergies: z.string().trim().max(500).default('')
}).strict().transform(guest => ({ ...guest, allergies: guest.attendance === 'attending' ? guest.allergies : '' }));
export type Companion = z.infer<typeof companionSchema>;

export const responseSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, '招待リンクをご確認ください'),
  attendance: z.enum(['attending', 'declining']),
  name: z.string().trim().min(1, 'お名前を入力してください').max(80),
  kana: z.string().trim().min(1, 'ふりがなを入力してください').max(100),
  guestSide: z.enum(['groom', 'bride', '']).optional(),
  postalCode: z.string().trim().max(8).regex(/^(?:[0-9]{3}-?[0-9]{4})?$/, '郵便番号は半角数字7桁で入力してください（ハイフン可）').optional(),
  address: z.string().trim().max(200).optional(),
  building: z.string().trim().max(200).optional(),
  email: z.union([z.string().trim().email('メールアドレスをご確認ください').max(254), z.literal('')]).default('').transform(s => s.toLowerCase()),
  allergies: z.string().trim().max(500).default(''),
  message: z.string().trim().max(1000).default(''),
  website: z.string().max(0).default(''),
  companions: z.array(companionSchema).max(MAX_COMPANIONS, '一度に回答できるのは10名までです').optional()
}).strict();

export type RsvpInput = z.infer<typeof responseSchema>;
