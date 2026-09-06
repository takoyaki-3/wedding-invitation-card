import { expect, it } from 'vitest';
import { createInviteUrl, gatheringFromSearch, parseInviteArgs } from '../shared/invitation';

it.each([
  ['親族', 'family', '11:25', '4階親族控室'],
  ['友人', 'friend', '12:00', '4階ロビー']
])('発行時の%s区分で集合案内を切り替える', (label, group, time, place) => {
  const args = parseInviteArgs(['山田 花子', label]);
  expect(args.group).toBe(group);
  const url = new URL(createInviteUrl('https://example.com/', 'a'.repeat(43), args.group));
  expect(url.search).toBe(`?group=${group}`);
  expect(url.hash).toBe(`#invite=${'a'.repeat(43)}`);
  expect(url.toString()).not.toContain(encodeURIComponent(args.name));
  expect(gatheringFromSearch(url.search)).toEqual({ time, place });
});

it.each(['', '?group=unknown'])('未指定・不明な区分は一般の集合案内にする: %s', search => {
  expect(gatheringFromSearch(search)).toEqual({ time: '12:00', place: '4階ロビー' });
});

it.each([['山田 花子'], ['山田 花子', 'その他'], [' ', '親族']])('名前と有効な区分を必須にする: %j', (...args) => {
  expect(() => parseInviteArgs(args)).toThrow('使い方');
});
