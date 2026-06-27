import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const code = request.nextUrl.searchParams.get("code");
  const { pathname } = request.nextUrl;

  // Intercepte /?code= → redirige vers reset-password
  if (code && pathname === "/") {
    const resetUrl = new URL("/mon-compte/reset-password", request.url);
    resetUrl.searchParams.set("code", code);
    return NextResponse.redirect(resetUrl);
  }

  // Laisse la page reset-password gérer le code elle-même — ne pas consommer via getUser()
  if (code && pathname === "/mon-compte/reset-password") {
    return NextResponse.next({ request });
  }

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/onboarding") ||
    (pathname.startsWith("/mon-compte") && !pathname.startsWith("/mon-compte/reset-password"));
  const isApi = pathname.startsWith("/api");

  // Tout ce qui n'est pas protégé est public (vitrine, slug, home, pro, etc.)
  if (isApi || !isProtected) return supabaseResponse;

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
