import type { Metadata } from 'next';
import './globals.css';
import { DemoProvider } from '@/components/demo-provider';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: { default: '소통해용 | 문산중학교 학생 자치 커뮤니티', template: '%s | 소통해용' },
  description: '문산중학교 학생 커뮤니티 및 학생 자치 업무 플랫폼 개발 초안',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><DemoProvider><AppShell>{children}</AppShell></DemoProvider></body></html>;
}
