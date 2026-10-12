import { expect, it } from 'vitest';
import { runtimeConfigSchema } from '../shared/runtime-config';

it.each(['/api/rsvp', 'https://api.example.com/custom-rsvp'])('本番の回答送信先を受け付ける: %s', rsvpEndpoint => {
  expect(runtimeConfigSchema.parse({ demo: false, rsvpEndpoint }).rsvpEndpoint).toBe(rsvpEndpoint);
});

it.each(['', '//other.example.com/api/rsvp', '/other', 'api/rsvp', 'http://api.example.com/rsvp', 'javascript:alert(1)'])('不正な回答送信先を拒否する: %s', rsvpEndpoint => {
  expect(runtimeConfigSchema.safeParse({ demo: false, rsvpEndpoint }).success).toBe(false);
});
