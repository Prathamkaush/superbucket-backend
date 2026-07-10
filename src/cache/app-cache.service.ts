import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

@Injectable()
export class AppCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(AppCacheService.name);
  private readonly memory = new Map<string, CacheEntry>();
  private readonly redis: any;
  private readonly upstashRestUrl?: string;
  private readonly upstashRestToken?: string;
  private readonly prefix = process.env.CACHE_PREFIX || "superbucket:";
  private readonly enabled = process.env.CACHE_ENABLED !== "false";

  constructor() {
    const redisUrl =
      process.env.REDIS_URL ||
      process.env.REDIS_CACHE_URL ||
      process.env.UPSTASH_REDIS_URL;
    this.upstashRestUrl = process.env.UPSTASH_REDIS_REST_URL;
    this.upstashRestToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!this.enabled) {
      this.logger.log("Cache disabled by CACHE_ENABLED=false");
      return;
    }

    if (!redisUrl && !this.hasUpstashRest()) {
      this.logger.log("Redis cache disabled; using in-memory cache fallback");
      return;
    }

    if (!redisUrl && this.hasUpstashRest()) {
      this.logger.log("Upstash REST cache enabled");
      return;
    }

    try {
      // Optional dependency: app still boots locally when Redis/ioredis is absent.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Redis = require("ioredis");
      this.redis = new Redis(redisUrl, {
        enableReadyCheck: true,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });

      this.redis.on("error", (error: Error) => {
        this.logger.warn(`Redis cache error: ${error.message}`);
      });
      this.redis.connect().catch((error: Error) => {
        this.logger.warn(`Redis cache unavailable: ${error.message}`);
      });
      this.logger.log("Redis protocol cache enabled");
    } catch (error) {
      if (this.hasUpstashRest()) {
        this.logger.warn(
          "ioredis is not installed; using Upstash REST cache fallback",
        );
        return;
      }

      this.logger.warn(
        `ioredis is not installed; using in-memory cache fallback`,
      );
    }
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    if (!this.enabled || ttlSeconds <= 0) {
      return loader();
    }

    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const redisKey = this.key(key);

    if (this.redis?.status === "ready") {
      const raw = await this.redis.get(redisKey).catch(() => null);
      return raw ? (JSON.parse(raw) as T) : undefined;
    }

    if (this.hasUpstashRest()) {
      const raw = await this.upstashCommand<string | null>("GET", redisKey);
      return raw ? (JSON.parse(raw) as T) : undefined;
    }

    const entry = this.memory.get(redisKey);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.memory.delete(redisKey);
      return undefined;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const redisKey = this.key(key);

    if (this.redis?.status === "ready") {
      await this.redis
        .set(redisKey, JSON.stringify(value), "EX", ttlSeconds)
        .catch(() => undefined);
      return;
    }

    if (this.hasUpstashRest()) {
      await this.upstashCommand(
        "SET",
        redisKey,
        JSON.stringify(value),
        "EX",
        ttlSeconds,
      );
      return;
    }

    this.memory.set(redisKey, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    const redisPrefix = this.key(prefix);

    for (const key of this.memory.keys()) {
      if (key.startsWith(redisPrefix)) {
        this.memory.delete(key);
      }
    }

    if (this.hasUpstashRest()) {
      let cursor = "0";
      do {
        const result = await this.upstashCommand<[string, string[]]>(
          "SCAN",
          cursor,
          "MATCH",
          `${redisPrefix}*`,
          "COUNT",
          100,
        );
        cursor = result?.[0] || "0";
        const keys = result?.[1] || [];
        if (keys.length) {
          await this.upstashCommand("DEL", ...keys);
        }
      } while (cursor !== "0");
      return;
    }

    if (this.redis?.status !== "ready") return;

    let cursor = "0";
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        "MATCH",
        `${redisPrefix}*`,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length) {
        await this.redis.del(...keys).catch(() => undefined);
      }
    } while (cursor !== "0");
  }

  stableKey(scope: string, value: unknown = "") {
    return `${scope}:${this.stableStringify(value)}`;
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  private key(key: string) {
    return `${this.prefix}${key}`;
  }

  private hasUpstashRest() {
    return Boolean(this.upstashRestUrl && this.upstashRestToken);
  }

  private async upstashCommand<T = unknown>(
    command: string,
    ...args: Array<string | number>
  ): Promise<T | undefined> {
    if (!this.upstashRestUrl || !this.upstashRestToken) return undefined;

    try {
      const response = await fetch(this.upstashRestUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.upstashRestToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([command, ...args]),
      });

      if (!response.ok) {
        this.logger.warn(`Upstash REST cache command failed: ${response.status}`);
        return undefined;
      }

      const data = await response.json().catch(() => null);
      return data?.result as T;
    } catch (error) {
      this.logger.warn(`Upstash REST cache error: ${(error as Error).message}`);
      return undefined;
    }
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    }

    return Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => {
        const item = (value as Record<string, unknown>)[key];
        return `${key}=${this.stableStringify(item)}`;
      })
      .join("&");
  }
}
