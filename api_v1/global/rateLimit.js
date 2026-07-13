import { redisDo } from './redisClient.js';
import { tools } from './functions.js';

/**
 * Fixed-window rate limiter backed by Redis. Fails open (allows the request)
 * if Redis is unreachable, so an infra outage doesn't lock everyone out of auth.
 * @param {string} key
 * @param {number} limit - max requests allowed per window
 * @param {number} windowSeconds
 * @returns {Promise<{allowed: boolean, retryAfterSeconds: number}>}
 */
export async function checkRateLimit(key, limit, windowSeconds) {
    try {
        return await redisDo(async (client) => {
            const count = await client.incr(key);
            if (count === 1) {
                await client.expire(key, windowSeconds);
            }
            const ttl = await client.ttl(key);
            return {
                allowed: count <= limit,
                retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
            };
        });
    }
    catch (err) {
        tools.serverLog(`Rate limit check failed for key ${key}: ${err}`, 'ratelimit_error_1');
        return { allowed: true, retryAfterSeconds: 0 };
    }
}

/**
 * Express middleware factory for route-level rate limiting.
 * @param {{ prefix: string, limit: number, windowSeconds: number, keyFn: (req: import('express').Request) => string }} opts
 */
export function rateLimitMiddleware({ prefix, limit, windowSeconds, keyFn }) {
    return async (/** @type {any} */ req, /** @type {any} */ res, /** @type {any} */ next) => {
        const identity = keyFn(req);
        const { allowed, retryAfterSeconds } = await checkRateLimit(`ratelimit:${prefix}:${identity}`, limit, windowSeconds);
        if (!allowed) {
            res.set('Retry-After', String(retryAfterSeconds));
            return res.status(429).json({ code: 429, message: 'Too many requests. Please try again later.' });
        }
        next();
    };
}
