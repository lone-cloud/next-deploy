import Stream from 'stream';
import zlib from 'zlib';
import { CloudFrontResultResponse, CloudFrontHeaders, CloudFrontRequest } from 'aws-lambda';
import { IncomingMessage, OutgoingHttpHeaders } from 'http';

import { PrivateServerResponse } from '../types';

const readOnlyCloudFrontHeaders: { [key: string]: boolean } = {
  'accept-encoding': true,
  'content-length': true,
  'if-modified-since': true,
  'if-none-match': true,
  'if-range': true,
  'if-unmodified-since': true,
  'transfer-encoding': true,
  via: true,
};

const HttpStatusCodes: Record<number, string> = {
  202: 'Accepted',
  502: 'Bad Gateway',
  400: 'Bad Request',
  409: 'Conflict',
  100: 'Continue',
  201: 'Created',
  417: 'Expectation Failed',
  424: 'Failed Dependency',
  403: 'Forbidden',
  504: 'Gateway Timeout',
  410: 'Gone',
  505: 'HTTP Version Not Supported',
  418: "I'm a teapot",
  419: 'Insufficient Space on Resource',
  507: 'Insufficient Storage',
  500: 'Server Error',
  411: 'Length Required',
  423: 'Locked',
  420: 'Method Failure',
  405: 'Method Not Allowed',
  301: 'Moved Permanently',
  302: 'Moved Temporarily',
  207: 'Multi-Status',
  300: 'Multiple Choices',
  511: 'Network Authentication Required',
  204: 'No Content',
  203: 'Non Authoritative Information',
  406: 'Not Acceptable',
  404: 'Not Found',
  501: 'Not Implemented',
  304: 'Not Modified',
  200: 'OK',
  206: 'Partial Content',
  402: 'Payment Required',
  308: 'Permanent Redirect',
  412: 'Precondition Failed',
  428: 'Precondition Required',
  102: 'Processing',
  407: 'Proxy Authentication Required',
  431: 'Request Header Fields Too Large',
  408: 'Request Timeout',
  413: 'Request Entity Too Large',
  414: 'Request-URI Too Long',
  416: 'Requested Range Not Satisfiable',
  205: 'Reset Content',
  303: 'See Other',
  503: 'Service Unavailable',
  101: 'Switching Protocols',
  307: 'Temporary Redirect',
  429: 'Too Many Requests',
  401: 'Unauthorized',
  422: 'Unprocessable Entity',
  415: 'Unsupported Media Type',
  305: 'Use Proxy',
};

const toCloudFrontHeaders = (headers: OutgoingHttpHeaders) => {
  const result: { [key: string]: any } = {};

  Object.keys(headers).forEach((headerName) => {
    const lowerCaseHeaderName = headerName.toLowerCase();
    const headerValue = headers[headerName];

    if (readOnlyCloudFrontHeaders[lowerCaseHeaderName]) {
      return;
    }

    result[lowerCaseHeaderName] = [];

    if (headerValue instanceof Array) {
      headerValue.forEach((val) => {
        result[lowerCaseHeaderName].push({
          key: headerName,
          value: val.toString(),
        });
      });
    } else {
      result[lowerCaseHeaderName].push({
        key: headerName,
        value: (headerValue as string).toString(),
      });
    }
  });

  return result;
};

const isGzipSupported = (headers: CloudFrontHeaders) => {
  let gz = false;
  const ae = headers['accept-encoding'];

  if (ae) {
    for (let i = 0; i < ae.length; i++) {
      const { value } = ae[i];
      const bits = value.split(',').map((x) => x.split(';')[0].trim());
      if (bits.indexOf('gzip') !== -1) {
        gz = true;
      }
    }
  }

  return gz;
};

const handler = ({
  request,
}: {
  request: CloudFrontRequest;
}): {
  responsePromise: Promise<CloudFrontResultResponse>;
  req: IncomingMessage;
  res: PrivateServerResponse;
} => {
  const response = {
    headers: {},
  } as CloudFrontResultResponse;

  const newStream = new Stream.Readable();
  const req = Object.assign(newStream, IncomingMessage.prototype);
  req.url = request.uri;
  req.method = request.method;
  req.rawHeaders = [];
  req.headers = {};
  // @ts-ignore
  req.connection = {};

  if (request.querystring) {
    req.url = `${req.url}?${request.querystring}`;
  }

  const headers = request.headers || {};

  for (const lowercaseKey of Object.keys(headers)) {
    const headerKeyValPairs = headers[lowercaseKey];

    headerKeyValPairs.forEach((keyVal) => {
      req.rawHeaders.push(keyVal.key as string);
      req.rawHeaders.push(keyVal.value);
    });

    req.headers[lowercaseKey] = headerKeyValPairs[0].value;
  }

  // @ts-ignore
  req.getHeader = (name: string) => req.headers[name.toLowerCase()];

  // @ts-ignore
  req.getHeaders = () => req.headers;

  if (request.body && request.body.data) {
    req.push(request.body.data, request.body.encoding ? 'base64' : undefined);
  }

  req.push(null);

  const res = new Stream() as PrivateServerResponse;
  res.finished = false;

  Object.defineProperty(res, 'statusCode', {
    get() {
      return response.status;
    },
    set(statusCode) {
      response.status = statusCode;
      response.statusDescription = HttpStatusCodes[statusCode];
    },
  });

  res.headers = {};
  //@ts-ignore
  res.writeHead = (status, headers: OutgoingHttpHeaders) => {
    response.status = status;

    if (headers) {
      res.headers = Object.assign(res.headers, headers);
    }
  };
  res.write = (chunk: any) => {
    if (!response.body) {
      // @ts-ignore
      response.body = Buffer.from('');
    }

    // @ts-ignore
    response.body = Buffer.concat([
      // @ts-ignore
      response.body,
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
    ]);

    return true;
  };

  const gz = isGzipSupported(headers);

  const responsePromise = new Promise<CloudFrontResultResponse>((resolve) => {
    res.end = (text: any) => {
      if (res.finished === true) {
        return;
      }

      res.finished = true;

      if (text) res.write(text);

      if (!res.statusCode) {
        res.statusCode = 200;
      }

      if (response.body) {
        response.bodyEncoding = 'base64';
        response.body = gz
          ? zlib.gzipSync(response.body).toString('base64')
          : Buffer.from(response.body).toString('base64');
      }

      response.headers = toCloudFrontHeaders(res.headers);

      if (gz) {
        response.headers['content-encoding'] = [{ key: 'Content-Encoding', value: 'gzip' }];
      }

      resolve(response);
    };
  });

  res.setHeader = (name, value) => {
    res.headers[name.toLowerCase()] = value;
  };
  res.removeHeader = (name) => {
    delete res.headers[name.toLowerCase()];
  };
  res.getHeader = (name) => res.headers[name.toLowerCase()];
  res.getHeaders = () => res.headers;
  res.hasHeader = (name) => !!res.getHeader(name);

  return {
    req,
    res,
    responsePromise,
  };
};

export default handler;
