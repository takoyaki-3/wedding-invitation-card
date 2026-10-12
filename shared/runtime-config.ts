import { z } from 'zod';

// Production endpoints are supplied by CDK, independently of the JS bundle.
export const runtimeConfigSchema = z.discriminatedUnion('demo', [
  z.object({ demo: z.literal(true), rsvpEndpoint: z.literal('') }),
  z.object({
    demo: z.literal(false),
    rsvpEndpoint: z.union([
      z.literal('/api/rsvp'),
      z.string().url().refine(value => value.toLowerCase().startsWith('https://'), 'HTTPS endpoint required')
    ])
  })
]);

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;
