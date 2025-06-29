import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Get the pathname of the request
  const { pathname } = request.nextUrl

  // Define the routes that require authentication (protected routes)
  const protectedRoutes = [
    '/esign-success',
    '/digilocker-success'
  ]

  // Check if the current route is in the protected routes list
    const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
)

  // If it's NOT a protected route, allow access without authentication
  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  // For protected routes, check for authToken in cookies
  const authToken = request.cookies.get('authToken')

  // If no authToken is found, redirect to login or home page
  if (!authToken || !authToken.value) {
    const loginUrl = new URL('/signup', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // If authToken exists, allow the request to proceed
  return NextResponse.next()
}

// Configure which routes this middleware should run on
export const config = {
  matcher: [
    '/signup/esign-success',
    '/signup/digilocker-success',
  ],
}