import type { WeddingConfig } from '../shared/wedding';

declare global {
  const __WEDDING_CONFIG__: WeddingConfig;
}
