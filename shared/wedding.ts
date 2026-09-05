import { z } from 'zod';

const text = z.string().trim().min(1);
const optionalDate = z.string().datetime({ offset: true }).or(z.literal(''));

export const weddingSchema = z.object({
  groom: text,
  bride: text,
  groomJapanese: text,
  brideJapanese: text,
  date: optionalDate,
  endDate: optionalDate,
  deadline: z.string().datetime({ offset: true }),
  receptionTime: text,
  ceremonyTime: text,
  partyTime: text,
  venue: text,
  venueJapanese: text,
  address: text,
  access: text,
  mapQuery: text,
  contactEmail: z.string().email()
});

export type WeddingConfig = z.infer<typeof weddingSchema>;

// Only this allowlist is embedded into the public invitation bundle.
export function weddingFromEnv(env: Record<string, string | undefined>): WeddingConfig {
  return weddingSchema.parse({
    groom: env.WEDDING_GROOM,
    bride: env.WEDDING_BRIDE,
    groomJapanese: env.WEDDING_GROOM_JAPANESE,
    brideJapanese: env.WEDDING_BRIDE_JAPANESE,
    date: env.WEDDING_DATE ?? '',
    endDate: env.WEDDING_END_DATE ?? '',
    deadline: env.WEDDING_DEADLINE,
    receptionTime: env.WEDDING_RECEPTION_TIME || '後日ご案内',
    ceremonyTime: env.WEDDING_CEREMONY_TIME || '後日ご案内',
    partyTime: env.WEDDING_PARTY_TIME || '後日ご案内',
    venue: env.WEDDING_VENUE,
    venueJapanese: env.WEDDING_VENUE_JAPANESE,
    address: env.WEDDING_ADDRESS,
    access: env.WEDDING_ACCESS,
    mapQuery: env.WEDDING_MAP_QUERY,
    contactEmail: env.WEDDING_CONTACT_EMAIL
  });
}
