[![Build Status](https://travis-ci.org/miter-framework/miter-socket-service.svg?branch=master)](https://travis-ci.org/miter-framework/miter-socket-service)

# miter-socket-service

`miter-socket-service` is a [Miter][miter] plugin to implement Web Sockets using [socket.io][socketio].

## Installation

Install `miter-socket-service` and `socket.io` using NPM.

```bash
npm install --save miter-socket-service socket.io
```

Add SocketService to the list of services used when launching your Miter server.

```typescript
import { SocketService } from 'miter-socket-service';

Miter.launch({
    //...
    
    services: [
        //...
        SocketService
    ]
});
```

## Contributing

Miter is a relatively young framework, and `miter-socket-service` is newer still. there are many ways that it can be improved. If you notice a bug, or would like to request a feature, feel free to [create an issue][create_issue]. Better yet, you can [fork the project][fork_project] and submit a pull request with the added feature.

## Changelog

[See what's new][whats_new] in recent versions of miter-socket-service.

## Attribution

Special thanks to [BrowserStack][browserstack] for generously hosting our cross-browser integration tests!

[![BrowserStack](./attribution/browser-stack.png)][browserstack]

[miter]: https://github.com/miter-framework/miter
[socketio]: https://socket.io
[create_issue]: https://github.com/miter-framework/miter-socket-service/issues/new
[fork_project]: https://github.com/miter-framework/miter-socket-service/pulls#fork-destination-box
[whats_new]: https://github.com/miter-framework/miter-socket-service/blob/master/CHANGELOG.md
[browserstack]: https://www.browserstack.com
