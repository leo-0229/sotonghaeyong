'use client';
import { RouteScreen } from './route-screen';
import { usePathname } from './navigation';
import {ScreenBoundary} from './screen-boundary';
export function StaticApp() { const pathname = usePathname(); return <ScreenBoundary key={pathname}><RouteScreen segments={pathname.split('/').filter(Boolean)}/></ScreenBoundary>; }
