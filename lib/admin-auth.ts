import { SignJWT, jwtVerify } from 'jose';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

export interface AdminSession {
  authenticated: boolean;
  expiresAt: number;
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  return password === ADMIN_PASSWORD;
}

export async function createAdminToken(): Promise<string> {
  const token = await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);

  return token;
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.admin === true;
  } catch (error) {
    return false;
  }
}

export function extractTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/admin_token=([^;]+)/);
    if (match) {
      return match[1];
    }
  }

  return null;
}
