interface CacheInterface {
    get: (key: string) => Promise<string | undefined>;
    set: (key: string, value: string) => Promise<boolean>;
    delete: (key: string) => Promise<boolean>;
    clear: () => Promise<void>;
}

type CacheGetKey = () => string | undefined;

type CacheShouldCacheResponse = () => boolean;

export type {
    CacheInterface,
    CacheGetKey,
    CacheShouldCacheResponse,
};
