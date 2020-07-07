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

type PreRenderedManifest = {
  version: 2;
  routes: {
    [route: string]: {
      initialRevalidateSeconds: number | false;
      srcRoute: string | null;
      dataRoute: string;
    };
  };
  dynamicRoutes: {
    [route: string]: {
      routeRegex: string;
      fallback: string | false;
      dataRoute: string;
      dataRouteRegex: string;
    };
  };
  preview: {
    previewModeId: string;
  };
};

type BuildOptions = {
  args?: string[];
  cwd?: string;
  cmd?: string;
};

type CreateServerlessConfigResult = {
  restoreUserConfig: () => Promise<void>;
};
