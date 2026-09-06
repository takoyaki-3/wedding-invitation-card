export type GuestGroup = 'family' | 'friend';

export function gatheringFromSearch(search: string) {
  return new URLSearchParams(search).get('group') === 'family'
    ? { time: '11:25', place: '4階親族控室' }
    : { time: '12:00', place: '4階ロビー' };
}

export function parseInviteArgs(args: string[]) {
  const [name, label] = args;
  if (!name?.trim() || args.length !== 2 || (label !== '親族' && label !== '友人')) {
    throw new Error('使い方: npm run invite -- "ゲストのお名前" "親族" または "友人"（AWS_PROFILE / AWS_REGION はデプロイ時と同じものを指定）');
  }
  const group: GuestGroup = label === '親族' ? 'family' : 'friend';
  return { name: name.trim(), label, group };
}

export function createInviteUrl(websiteUrl: string, token: string, group: GuestGroup) {
  const url = new URL(websiteUrl);
  url.searchParams.set('group', group);
  url.hash = new URLSearchParams({ invite: token }).toString();
  return url.toString();
}
