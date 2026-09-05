import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { weddingFromEnv } from '../shared/wedding';
import { z } from 'zod';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const notificationEmail = z.string().trim().email().or(z.literal(''));

export function loadEnvironment(root = projectRoot, overrides: NodeJS.ProcessEnv = process.env) {
  const read = (name: string) => {
    const filename = resolve(root, name);
    return existsSync(filename) ? parseEnv(readFileSync(filename, 'utf8')) : {};
  };
  // Explicit shell/CI values win, then .env.local, then .env.
  const env = { ...read('.env'), ...read('.env.local'), ...overrides };
  try {
    return {
      wedding: weddingFromEnv(env),
      ses: {
        senderEmail: env.SES_SENDER_EMAIL || env.WEDDING_CONTACT_EMAIL!,
        identityDomain: env.SES_IDENTITY_DOMAIN || '',
        identityArn: env.SES_IDENTITY_ARN || '',
        configurationSetName: env.SES_CONFIGURATION_SET_NAME || '',
        hostEmail: notificationEmail.parse(env.RSVP_HOST_EMAIL || ''),
        groomEmail: notificationEmail.parse(env.RSVP_GROOM_EMAIL || ''),
        brideEmail: notificationEmail.parse(env.RSVP_BRIDE_EMAIL || '')
      }
    };
  } catch (error) {
    throw new Error('招待状の環境設定をご確認ください。.env.example を .env.local にコピーして必要項目を設定してください。', { cause: error });
  }
}
