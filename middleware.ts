import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const { pathname } = request.nextUrl;

  // Intercepte /?code= → redirige vers reset-password
  if (code && pathname === "/") {
    const resetUrl = new URL("/mon-compte/reset-password", request.url);
    resetUrl.searchParams.set("code", code);
    return NextResponse.redirect(resetUrl);
  }

  // Laisse la page reset-password gérer le code elle-même, ne pas le consommer ici
  if (code && pathname === "/mon-compte/reset-password") {
    return NextResponse.next({ request });
  }

  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/onboarding") ||
    (pathname.startsWith("/mon-compte") && !pathname.startsWith("/mon-compte/reset-password"));

  // Sortie immédiate pour tout ce qui est public : pages vitrine, fiches salon,
  // et surtout les routes /api.
  //
  // `supabase.auth.getUser()` est un aller-retour réseau vers le serveur
  // d'authentification. Le placer avant ce test le déclenchait sur CHAQUE
  // requête, y compris sur les sept appels à /api/booking/slots que le widget
  // de réservation émet par semaine affichée. Sous l'affluence, le middleware
  // saturait et Vercel renvoyait 504 MIDDLEWARE_INVOCATION_TIMEOUT sur tout le
  // site. Constaté en production le 30/08/2026.
  //
  // Les pages publiques n'ont besoin d'aucune session : le rafraîchissement du
  // jeton est assuré par le client Supabase du navigateur, et par ce middleware
  // dès qu'une page protégée est demandée.
  if (!isProtected) return NextResponse.next({ request });

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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  // Chaque exclusion est une invocation de middleware en moins, donc de la
  // marge en cas d'affluence.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)",
  ],
};
