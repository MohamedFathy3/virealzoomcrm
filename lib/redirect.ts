import { NextResponse } from 'next/server';

export function redirectToPath(path: string, status = 303) {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('Redirect path must be an internal absolute path');
  }

  return new NextResponse(null, {
    status,
    headers: { Location: path },
  });
}
