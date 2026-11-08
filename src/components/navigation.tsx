'use client';
import NextLink from 'next/link';
import { useSyncExternalStore } from 'react';
import type { ComponentProps } from 'react';

// Hash navigation keeps arbitrary post/task IDs reloadable on GitHub Pages.
const subscribe = (callback: () => void) => { window.addEventListener('hashchange', callback); return () => window.removeEventListener('hashchange', callback); };
const snapshot = () => window.location.hash.slice(1) || '/';
export function useLocation() { return useSyncExternalStore(subscribe, snapshot, () => '/'); }
export function usePathname() { return useLocation().split('?')[0]; }
export function useSearchParams() { return new URLSearchParams(useLocation().split('?')[1] ?? ''); }
export function useRouter() { return { push: (path: string) => { window.location.hash = path; window.scrollTo(0, 0); }, replace: (path: string) => { history.replaceState(null, '', `#${path}`); window.dispatchEvent(new HashChangeEvent('hashchange')); } }; }
export default function Link({ href, onClick, ...props }: ComponentProps<typeof NextLink>) {
  const value = typeof href === 'string' ? href : String(href.pathname ?? '/');
  const internal = value.startsWith('/');
  return <a {...props as ComponentProps<'a'>} href={internal ? `#${value}` : value} onClick={e => { onClick?.(e); if (internal && !e.defaultPrevented) window.scrollTo(0, 0); }}/>;
}
