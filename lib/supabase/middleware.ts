import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { puedeAccederRuta, rutaInicio, tieneAccesoPortal } from '@/lib/auth';

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
  const isSetPassword = request.nextUrl.pathname === '/set-password';
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard');
  const path = request.nextUrl.pathname;
  const isApi = path.startsWith('/api');

  if (!user && isDashboard) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Recuperación / invitación: permitir set-password con sesión parcial
  if (user && isLoginPage && !isSetPassword) {
    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('role')
      .eq('id', user.id)
      .single();
    return NextResponse.redirect(new URL(rutaInicio(staffUser?.role), request.url));
  }

  if (user && isDashboard && !isApi) {
    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (!staffUser?.is_active || !tieneAccesoPortal(staffUser.role)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (!puedeAccederRuta(staffUser.role, path)) {
      return NextResponse.redirect(new URL(rutaInicio(staffUser.role), request.url));
    }
  }

  return supabaseResponse;
}
