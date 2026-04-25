import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  const session = cookies().get("session")?.value || "";

  if (!session) {
    return NextResponse.json({ isLogged: false }, { status: 401 });
  }

  try {
    const decodedClaims = await auth.verifySessionCookie(session, true);
    return NextResponse.json({ isLogged: true, user: decodedClaims });
  } catch (error) {
    return NextResponse.json({ isLogged: false }, { status: 401 });
  }
}
