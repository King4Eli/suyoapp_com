import { redisDo } from './redisClient.js';
import { tools } from './functions.js';

// INCR + "set TTL only on the first hit" run as one atomic Lua script so a crash or
// network failure between the two steps can't leave a counter behind that never expires.
// (Plain Lua/EVAL instead of EXPIRE's NX flag, which needs Redis >= 7.0.)
const INCR_AND_EXPIRE_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {count, ttl}
`;

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
            /** @type {any} */
            const result = await client.eval(INCR_AND_EXPIRE_SCRIPT, {
                keys: [key],
                arguments: [String(windowSeconds)],
            });
            const [count, ttl] = result.map(Number);
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
