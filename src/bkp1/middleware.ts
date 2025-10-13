
import { NextRequest, NextResponse } from 'next/server';

// This middleware function does nothing and just passes the request along.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}
 
export const config = {
  matcher: ['/((?!api|static|.*\\..*|_next|favicon.ico|robots.txt).*)'],
};
