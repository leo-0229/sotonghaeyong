import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Production adapter foundation. The prototype UI intentionally does not use this client. */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase 환경변수가 설정되지 않았습니다. 현재 UI는 브라우저 체험 모드입니다.');
  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: values => { values.forEach(({ name, value, options }) => jar.set(name, value, options)); },
    },
  });
}

/** Call from a Route Handler or Server Action. Verify the token with Auth, never trust a client role. */
export async function requireActiveMember() {
  const client = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error('로그인이 필요합니다.');
  const { data: profile, error } = await client.from('profiles').select('id,display_name,class_id,status').eq('id', user.id).single();
  if (error || profile?.status !== 'ACTIVE') throw new Error('담당 교사의 회원 승인이 필요합니다.');
  return { client, user, profile };
}
