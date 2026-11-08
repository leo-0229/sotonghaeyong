'use client';
import { RouteScreen } from './route-screen';
import { usePathname } from './navigation';
export function StaticApp() { const pathname = usePathname(); return <RouteScreen key={pathname} segments={pathname.split('/').filter(Boolean)}/>; }
