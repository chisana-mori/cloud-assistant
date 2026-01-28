import jwt from 'jsonwebtoken';

/**
 * JWT 认证工具
 */

export interface JwtPayload {
    userId: string;
    username?: string;
    email?: string;
    exp?: number;
}

export class JwtAuth {
    constructor(
        private secret: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    ) { }

    /**
     * 生成 JWT Token
     */
    sign(payload: JwtPayload, expiresIn: string = '24h'): string {
        return jwt.sign(payload, this.secret, { expiresIn });
    }

    /**
     * 验证 JWT Token
     */
    verify(token: string): JwtPayload {
        try {
            return jwt.verify(token, this.secret) as JwtPayload;
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    /**
     * 解码 Token（不验证）
     */
    decode(token: string): JwtPayload | null {
        return jwt.decode(token) as JwtPayload | null;
    }
}

// 单例
export const jwtAuth = new JwtAuth();
