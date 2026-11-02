import { NextResponse, type NextRequest } from "next/server";

// Chequeo liviano: sin cookie de sesión → al login. La validación real del token se hace en cada API.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("elege_session")) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
