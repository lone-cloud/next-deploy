import { CloudFrontRequest } from 'aws-lambda';
import { ServerResponse, OutgoingHttpHeaders } from 'http';

export class PrivateServerResponse extends ServerResponse {
  headers: OutgoingHttpHeaders;
}

type DynamicPageKeyValue = {
  [key: string]: {
    file: string;
    regex: string;
  };
};

type OriginRequestApiHandlerManifest = {
  apis: {
    dynamic: DynamicPageKeyValue;
    nonDynamic: {
      [key: string]: string;
    };
  };
};

type OriginRequestDefaultHandlerManifest = {
  buildId: string;
  pages: {
    ssr: {
      dynamic: DynamicPageKeyValue;
      nonDynamic: {
        [key: string]: string;
      };
    };
    html: {
      nonDynamic: {
        [path: string]: string;
      };
      dynamic: DynamicPageKeyValue;
    };
  };
  publicFiles: {
    [key: string]: string;
  };
};

type OriginRequestEvent = {
  Records: [{ cf: { request: CloudFrontRequest } }];
};

type CreateServerlessConfigResult = {
  restoreUserConfig: () => Promise<void>;
};
