import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === '/login';
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard');
  const path = request.nextUrl.pathname;

  if (!user && isDashboard) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && isLoginPage) {
    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('role')
      .eq('id', user.id)
      .single();
    const dest = staffUser?.role === 'logistica' ? '/dashboard/rutas' : '/dashboard';
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Logística solo ve rutas
  if (user && isDashboard && !path.startsWith('/dashboard/rutas')) {
    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('role, is_active')
      .eq('id', user.id)
      .single();
    if (staffUser?.role === 'logistica' && staffUser.is_active) {
      return NextResponse.redirect(new URL('/dashboard/rutas', request.url));
    }
  }

  return supabaseResponse;
}
