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

type OriginRequestHandlerManifest = {
  buildId: string;
  pages: {
    ssr: {
      dynamic: DynamicPageKeyValue;
      nonDynamic: {
        [key: string]: string;
      };
    };
    html: {
      dynamic: DynamicPageKeyValue;
      nonDynamic: {
        [path: string]: string;
      };
    };
    apis: {
      dynamic: DynamicPageKeyValue;
      nonDynamic: {
        [key: string]: string;
      };
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
