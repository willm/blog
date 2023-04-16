---
layout: post
title:  "🎾 Implementing fetch in node 🐕"
date:   2023-04-15 14:00:00 +0000
categories: javascript node http
---

# 🎾 Implementing fetch in node 🐕

node 18 provides the handy `fetch()` function which we can use to make HTTP requests to a remote server. But what exactly does `fetch` do? This is not a question we often ask ourselves but it's a good opportunity to step down a level and appreciate the networking required to give us such a function.

When talking about networking, you'll often here people mention the [Open Systems Interconnection (OSI) model](https://en.wikipedia.org/wiki/OSI_model). This is a way of breaking down networking technologies into *layers*

```
7. Application
6. Presentation
5. Session
4. Transport
3. Network
2. Data link
1. Physical 
```

HTTP is a layer 7 or *application protocol*. It provides a standard way for clients and servers to communicate over a layer 4 *transport protocol*. Most commonly, that transport protocol is TCP although more recent evolutions of HTTP explore using other transport protocols such as [QUIC](https://en.wikipedia.org/wiki/QUIC) to improve some of the limitations of TCP. The scope of this article is to implement a fetch function for HTTP 1.1 (not HTTPS) connections over TCP IP only.

With that little bit of theory out of the way, lets get going.

## The task

We'll be looking at implementing this piece of code.

```javascript
const response = await fetch('http://example.com');
console.log(await response.text());
```

## URL parsing

The [`url`](https://nodejs.org/dist/latest-v18.x/docs/api/url.html#class-url) module can be used to parse the url. In order to write our fetch function we need to split this string:

**http://example.com/?foo=bar#hash**

into it's parts

| Protocol | hostname     | port   | pathname | search    | hash |
| -------- | ----     | ----   | ---- | ----     | ---  |
| http:    | localhost| 80 (the default port for http)  | /    | ?foo=bar   | #hash |

---

## URL parsing

This is exactly what the `URL` constructor does.

```javascript
import {URL} from 'url';
const url = new URL('http://example.com/?foo=bar#hash');

URL {
  href: 'http://example.com/?foo=bar#hash',
  origin: 'http://example.com',
  protocol: 'http:',
  username: '',
  password: '',
  host: 'example.com',
  hostname: 'example.com',
  port: '',
  pathname: '/',
  search: '?foo=bar',
  searchParams: URLSearchParams { 'foo' => 'bar' },
  hash: '#hash'
}
```

Note that this gives us everything except the port which we need to default to `80`.

## DNS lookup

Now that we've split the url, in order to make an http request over TCP IP, we need to have the IP address of the server we're trying to connect to. We don't typically remember website's based on IP address this is where DNS and the [dns module](https://nodejs.org/dist/latest-v18.x/docs/api/dns.html#dnspromiseslookuphostname-options) comes in handy. It allows us to convert a host name to an ip address.

```javascript
import {promises as dns} from 'node:dns';

const dnsRecord = await dns.lookup('example.com');
//dnsRecord.address -> 93.184.216.34
//dnsRecord.family -> 4
```

`address` is the ip address we looked up and `family` tells us it's an IPV4 address as opposed to IPV6

## Connecting over TCP IP

The [`net` module](https://nodejs.org/dist/latest-v18.x/docs/api/net.html#netcreateconnection) allows us to make TCP connections. It needs the ip and the port. The `createConnection` function returns a [Duplex stream](https://nodejs.org/dist/latest-v18.x/docs/api/stream.html#duplex-and-transform-streams).

```javascript
import {createConnection} from 'net';
const exampleDotComIp = '93.184.216.34';

const connection = createConnection(
  {port: 80, host: exampleDotComIp},
  () => {
    console.log('connected!');
  }
);
```

If everything went well, the callback function was called to log we have created a connection to the remote server.

## Building our HTTP request

Now that we have an open TCP connection to `example.com`, we need to send it some data to initiate an HTTP request.

HTTP requests follow the follow the following format
* `method` - a valid [HTTP request method](https://en.wikipedia.org/wiki/HTTP#Request_methods) (eg `GET` or `POST`)
* `path` - the pathname from our parsed URL object.
* `version` - the version of HTTP we are using (1.1 in our case)
* `headers` - key value pairs of the request headers specified separated by a `:`
* `request body` GET requests don't typically have a body but if we were sending a `POST` request, this would follow the headers.

At a minimum the server requires us to specify the host header as HTTP allows multiple hosts to reside on the same IP address.

Here's the request we're aiming for.

```
GET / HTTP/1.1
host: example.com

```

```javascript
import {createConnection} from 'net';
const exampleDotComIp = '93.184.216.34';

const connection = createConnection(
  {port: 80, host: exampleDotComIp},
  () => {
    const request = 'GET / HTTP/1.1\n' +
      'host: example.com\n\n';
    connection.write(request);
  }
);
```

We just made our HTTP request. However this isn't much use to us because we're not handling the server's response in any way.

## Handling the HTTP response

Just like HTTP requests, responses from the server also get sent in a standard format and includes the following information.

* The HTTP `version` that the server is responding with
* The HTTP [status code](https://httpwg.org/specs/rfc9110.html#status.codes) of the response to indicate how the request was processed
* The response headers in the same format as the request headers above
* The response body

A successful response will look something like this

```
HTTP/1.1 200 OK
response_header_key: response_header_value

<DOCTYPE html>
<html>.....
```

Let's take a second to go back the code we're trying to implement.

```javascript
const response = await fetch('http://example.com');
console.log(await response.text());
```

Now the http response is potentially very large, maybe even *infinitely* large. In order for `fetch` to provide an api that can be useful in all scenarios, it doesn't read the entire response before resolving. Instead, it reads the status line and the headers then returns control back to the client. This allows the client to inspect the status and headers before deciding what to do with the response body.

To start with let's focus on the first line and resolve the `fetch()` promise.

### Reading the response headers

Our client code is not overly concerned with the status or headers. Lets start by just resolving once the headers have been read. Now [the HTTP spec](https://www.rfc-editor.org/rfc/rfc2616#section-6) tells us that the headers end once we receive a carriage return and line feed (`CRLF`) sequence. This is represented by the `bodyStartMarker` variable.
When the TCP stream emits a new chunk of data, we look at what has already been received and check if we have a `CRLF` sequence. If we do, we pause the stream and callback to the consumer with a response object containing the `text` function. This in turn resolves the `fetch` promise leaving the decision of what to do next up to the consumer.

```javascript
const readResponse = (connection, onHeaders) => {
  const bodyStartMarker = '\n\r';
  let rawHeaders = '';

  connection.on('data', (data) => {
    for (let char of data.toString('utf8')) {
      const previousChar = rawHeaders.slice(-1);
      if (`${previousChar}${char}` === bodyStartMarker) {
        connection.pause();
        onHeaders({
          async text() {}
        })
        continue;
      } else {
        rawHeaders += char;
      }
    }
  });
};

const fetch = async (url) => {
  // parseUrl();
  // getIpFromDNSLookup();
  return new Promise((resolve) => {
    const connection = createConnection(
      {port: port, host: ip},
      () => {
        // sendRequest();
        readResponse(connection resolve);
      }
    );
  });
}
```

You might think that we can simply listen for the connection's `end` event to tell us when the response is finished however this is not the case. This is because the TCP connection remains open after the response is fully sent. This is actually a great thing because setting up a TCP connection is expensive. Keeping it open allows clients to reuse the same TCP connection for multiple HTTP requests.

There is therefore one response header that we do care about. The `content-length` header tells us how many bytes the body contains. This is how we know when the full body has been sent and we can resolve the `text()` promise Later on.

Once we've received the headers we can try to parse the header before calling back so we have it for later. I've done this here using a regexp with a named group.

```javascript
const parseContentLength = (rawHeaders) => {
  const pattern = /content-length: (?<contentLength>\d+)/i;
  return Number(
    rawHeaders.match(pattern).groups.contentLength
  );
};

const readResponse = (connection, onHeaders) => {
  const bodyStartMarker = '\n\r';
  let contentLength;
  let rawHeaders = '';

  connection.on('data', (data) => {
    for (let char of data.toString('utf8')) {
      const previousChar = rawHeaders.slice(-1);
      contentLength = parseContentLength(rawHeaders);

      if (`${previousChar}${char}` === bodyStartMarker) {
        connection.pause();
        onHeaders({
          async text() {}
        })
        continue;
      } else {
        rawHeaders += char;
      }
    }
  });
};
```

### Reading the response body

Now let's focus on the next line of our client code.

```javascript
console.log(await response.text());
```

In our current implementation this will print `undefined`. What we need to do is resume reading the rest of the response data when the `text()` method is called and resolve it when we've read the number of bytes specified in our `contentLength`.

Our `data` event handler needs to do something different once the response headers have been sent to start writing the body so let's introduce a `headersRead` flag. let's also introduce a new `body` variable to store the body.

Once the headers have been read let's make the `text()` function resume reading the rest of the data.

Once we've read the number of bytes specified in our `contentLength` we resolve the `text()` promise.

```javascript
const readResponse = (connection, onHeaders) => {
  const bodyStartMarker = '\n\r';
  let contentLength;
  let onBody = () => {};
  let rawHeaders = '';
  let body = '';
  let headersRead = false;

  connection.on('data', (data) => {
    for (let char of data.toString('utf8')) {
      if (!headersRead) {
        const previousChar = rawHeaders.slice(-1);
        if (`${previousChar}${char}` === bodyStartMarker) {
          contentLength = parseContentLength(rawHeaders);
          headersRead = true;
          connection.pause();
          onHeaders({
            async text() {
              connection.resume();
              return new Promise((resolve) => {
                onBody = resolve;
              })
            }
          })
          continue;
        }
        rawHeaders += char;
        continue;
      } else {
        body += char;
        if (body.length === contentLength) {
          connection.end(() => onBody(body));
        }
      }
    }
  });
};
```

## ⚠️ Warning happy path only

We now have a working implementation of our fetch function. It should work for any HTTP 1.1 server over TCP returning a text based body. However a lot could go wrong here that we would want to handle in a real worlds implementation.

* The URL being invalid
* Using an unsupported protocol
* Failed DNS lookups
* The TLS connection failing or being unexpectedly dropped
* No response body (eg in a 204 no content response)
* All types of bad response data (missing/invalid `content-length`, headers never properly closed, body ending before we expect, etc)

We also should avoid leaking TCP connections and close the connection once it's no longer needed.

I won't go into the implementation of these in this post but it's important to note them.

As a closing note, here's our final implementation.

```javascript

import {URL} from 'url';
import {promises as dns} from 'node:dns';
import {createConnection} from 'net';

const parseContentLength = (rawHeaders) => {
  const pattern = /content-length: (?<contentLength>\d+)/i;
  return Number(
    rawHeaders.match(pattern).groups.contentLength
  );
};

const readResponse = (connection, onHeaders) => {
  const bodyStartMarker = '\n\r';
  let contentLength;
  let onBody = () => {};
  let rawHeaders = '';
  let body = '';
  let headersRead = false;

  connection.on('data', (data) => {
    for (let char of data.toString('utf8')) {
      if (!headersRead) {
        const previousChar = rawHeaders.slice(-1);
        if (`${previousChar}${char}` === bodyStartMarker) {
          contentLength = parseContentLength(rawHeaders);
          headersRead = true;
          connection.pause();
          onHeaders({
            async text() {
              connection.resume();
              return new Promise((resolve) => {
                onBody = resolve;
              })
            }
          })
          continue;
        }
        rawHeaders += char;
        continue;
      } else {
        body += char;
        if (body.length === contentLength) {
          connection.end(() => onBody(body));
        }
      }
    }
  });
};

export const fetch = async (urlString) => {
  const url = new URL(urlString);
  const dnsRecord = await dns.lookup(url.hostname);
  return new Promise((resolve) => {
    const connection = createConnection(
      {port: url.port || 80, host: dnsRecord.address},
      () => {
        const request = `GET ${url.pathname} HTTP/1.1` + '\n' +
          `host: ${url.hostname}` + '\n\n';
        connection.write(request);
        readResponse(connection, resolve);
      }
    );
  });
}
```