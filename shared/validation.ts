import { z } from 'zod';

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
  consent: z.literal(true),
  website: z.string().max(0).default('')
}).strict();

export type RsvpInput = z.infer<typeof responseSchema>;
