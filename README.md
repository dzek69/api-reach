# api-reach

JavaScript universal API Client that is easy, just-works and is feature rich. Based on `fetch`.
WIP.

TypeScript support is limited.

## Features

@TODO

## TODO

### Important

- better TS support
- methods alternative parameters input (single object instead of sequenced params)

### Less important

- cookie jar support
- add files upload support
- handle multiple same header
- handle same header, different letters case
- if using url with query params and object query params - merge them
- add abort container wrapper, that will abort all requests in it (useful for stopping stuff for websites) [?]
- add a lot of tests
- audit for memory leaks or performance degrading (compared to bare fetch)

### Almost not important

- code cleanup (eliminate hardcoded values)
- allow injecting qs methods
- handle >= 600 statuses as unknown status
- do not pass unknown options to `fetch`
- handle unknown options (incorrect type)

## License

MIT
