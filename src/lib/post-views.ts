import type {Post} from './domain';

export const viewDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);

export function getPopularPosts(posts:Post[]) {
  return posts.filter(post => post.status === 'APPROVED' && post.views > 0)
    .sort((a,b) => b.views-a.views || +new Date(b.date)-+new Date(a.date) || a.id.localeCompare(b.id));
}
