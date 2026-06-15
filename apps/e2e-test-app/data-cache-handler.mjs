/**
 * Unified data cache handler for e2e tests
 * Switches between memory, Redis, and ElastiCache based on CACHE_HANDLER env var
 */

const cacheType = process.env.CACHE_HANDLER || process.env.DATA_CACHE_HANDLER || "memory";

console.log(`[DataCacheHandler] Using cache type: ${cacheType}`);

let handler;

if (cacheType === "redis") {
  const Redis = (await import("ioredis")).default;
  const { createRedisDataCacheHandler } = await import(
    "@mrjasonroy/cache-components-cache-handler"
  );

  const url = process.env.REDIS_URL || process.env.DATA_CACHE_URL || "redis://localhost:6379";
  const ioredisClient = new Redis(url);

  ioredisClient.on("error", (err) => {
    console.error("[Redis] Connection error:", err);
  });

  ioredisClient.on("connect", () => {
    console.log("[Redis] Connected successfully to", url);
  });

  const redis = {
    get: (key) => ioredisClient.get(key),
    set: (key, value, ...args) => {
      const opts = args[0];
      if (opts && typeof opts === "object" && typeof opts.EX === "number") {
        return ioredisClient.set(key, value, "EX", opts.EX);
      }
      return ioredisClient.set(key, value);
    },
    del: (...keys) => ioredisClient.del(...keys),
    exists: (...keys) => ioredisClient.exists(...keys),
    ttl: (key) => ioredisClient.ttl(key),
    hGet: (key, field) => ioredisClient.hget(key, field),
    hSet: (key, field, value) => ioredisClient.hset(key, field, value),
    hGetAll: (key) => ioredisClient.hgetall(key).then((r) => r ?? {}),
  };

  handler = createRedisDataCacheHandler({
    redis,
    keyPrefix: "e2e:cache:",
    tagPrefix: "e2e:tags:",
    defaultTTL: 86400,
    debug: process.env.CACHE_DEBUG === "true",
  });
} else if (cacheType === "elasticache") {
  const Redis = (await import("ioredis")).default;
  const { createRedisDataCacheHandler } = await import(
    "@mrjasonroy/cache-components-cache-handler"
  );

  const endpoint = process.env.ELASTICACHE_ENDPOINT;
  const port = Number.parseInt(process.env.ELASTICACHE_PORT || "6379", 10);

  if (!endpoint) {
    throw new Error("ELASTICACHE_ENDPOINT environment variable is required");
  }

  const config = {
    host: endpoint,
    port,
    tls: process.env.ELASTICACHE_TLS !== "false" ? {} : undefined,
    connectTimeout: 10000,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error("[ElastiCache] Max retry attempts reached");
        return null;
      }
      return Math.min(times * 200, 2000);
    },
  };

  if (process.env.ELASTICACHE_AUTH_TOKEN) {
    console.log("[ElastiCache] Using auth token authentication");
    config.password = process.env.ELASTICACHE_AUTH_TOKEN;
  } else {
    console.log("[ElastiCache] No authentication configured");
  }

  const ioredisClient = new Redis(config);

  ioredisClient.on("error", (err) => {
    console.error("[ElastiCache] Connection error:", err);
  });

  ioredisClient.on("connect", () => {
    console.log("[ElastiCache] Connected successfully to", endpoint);
  });

  const redis = {
    get: (key) => ioredisClient.get(key),
    set: (key, value, ...args) => {
      const opts = args[0];
      if (opts && typeof opts === "object" && typeof opts.EX === "number") {
        return ioredisClient.set(key, value, "EX", opts.EX);
      }
      return ioredisClient.set(key, value);
    },
    del: (...keys) => ioredisClient.del(...keys),
    exists: (...keys) => ioredisClient.exists(...keys),
    ttl: (key) => ioredisClient.ttl(key),
    hGet: (key, field) => ioredisClient.hget(key, field),
    hSet: (key, field, value) => ioredisClient.hset(key, field, value),
    hGetAll: (key) => ioredisClient.hgetall(key).then((r) => r ?? {}),
  };

  handler = createRedisDataCacheHandler({
    redis,
    keyPrefix: "e2e:cache:",
    tagPrefix: "e2e:tags:",
    defaultTTL: 86400,
    debug: process.env.CACHE_DEBUG === "true",
  });
} else {
  const { createMemoryDataCacheHandler } = await import(
    "@mrjasonroy/cache-components-cache-handler"
  );

  handler = createMemoryDataCacheHandler({
    maxSize: 100 * 1024 * 1024,
    debug: process.env.CACHE_DEBUG === "true",
  });

  console.log("[MemoryDataCache] Handler initialized");
}

export default handler;
