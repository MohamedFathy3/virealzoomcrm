import { redirectToPath } from '@/lib/redirect';

export async function GET(request: Request) {
  return redirectToPath('/login', 307);
}
