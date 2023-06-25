# api-reach

JavaScript universal API Client that is easy, just-works and is feature rich. Based on `fetch`.
WIP.

TypeScript support is limited.

## Features

@TODO

## TODO

### More important

- cookie jar support
- add files upload support
- handle multiple same header
- handle same header, different letters case
- add abort container wrapper, that will abort all requests in it (useful for stopping stuff for websites) [?]
- add a lot of tests
- audit for memory leaks or performance degrading (compared to bare fetch)

### Less important

- requests deduplication
- do not pass unknown options to `fetch`
- handle unknown options (incorrect type)
- option to not wait for cache to save before resolving
- expose cache errors via options callback

## License

MIT
