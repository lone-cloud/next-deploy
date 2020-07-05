// @ts-ignore
import PrerenderManifest from './prerender-manifest.json';
// @ts-ignore
import Manifest from './manifest.json';
import lambdaAtEdgeCompat from 'next-aws-cloudfront';
import {
  CloudFrontRequest,
  CloudFrontS3Origin,
  CloudFrontOrigin,
  CloudFrontResultResponse,
} from 'aws-lambda';
import {
  OriginRequestEvent,
  OriginRequestDefaultHandlerManifest,
  PreRenderedManifest as PrerenderManifestType,
} from '../types';

const addS3HostHeader = (req: CloudFrontRequest, s3DomainName: string): void => {
  req.headers['host'] = [{ key: 'host', value: s3DomainName }];
};

const isDataRequest = (uri: string): boolean => uri.startsWith('/_next/data');

const normaliseUri = (uri: string): string => (uri === '/' ? '/index' : uri);

const normaliseS3OriginDomain = (s3Origin: CloudFrontS3Origin): string => {
  if (s3Origin.region === 'us-east-1') {
    return s3Origin.domainName;
  }

  if (!s3Origin.domainName.includes(s3Origin.region)) {
    const regionalEndpoint = s3Origin.domainName.replace(
      's3.amazonaws.com',
      `s3.${s3Origin.region}.amazonaws.com`
    );
    return regionalEndpoint;
  }

  return s3Origin.domainName;
};

const router = (manifest: OriginRequestDefaultHandlerManifest): ((uri: string) => string) => {
  const {
    pages: { ssr, html },
  } = manifest;

  const allDynamicRoutes = { ...ssr.dynamic, ...html.dynamic };

  return (uri: string): string => {
    let normalizedUri = uri;

    if (isDataRequest(uri)) {
      normalizedUri = uri.replace(`/_next/data/${manifest.buildId}`, '').replace('.json', '');
    }

    if (ssr.nonDynamic[normalizedUri]) {
      return ssr.nonDynamic[normalizedUri];
    }

    for (const route in allDynamicRoutes) {
      const { file, regex } = allDynamicRoutes[route];

      const re = new RegExp(regex, 'i');
      const pathMatchesRoute = re.test(normalizedUri);

      if (pathMatchesRoute) {
        return file;
      }
    }

    // only use the 404 page if the project exports it
    if (html.nonDynamic['/404'] !== undefined) {
      return 'pages/404.html';
    }

    return 'pages/_error.js';
  };
};

export const handler = async (
  event: OriginRequestEvent
): Promise<CloudFrontResultResponse | CloudFrontRequest> => {
  const request = event.Records[0].cf.request;
  const uri = normaliseUri(request.uri);
  const manifest: OriginRequestDefaultHandlerManifest = Manifest;
  const prerenderManifest: PrerenderManifestType = PrerenderManifest;
  const { pages, publicFiles } = manifest;
  const isStaticPage = pages.html.nonDynamic[uri];
  const isPublicFile = publicFiles[uri];
  const isPrerenderedPage = prerenderManifest.routes[request.uri]; // prerendered pages are also static pages like "pages.html" above, but are defined in the prerender-manifest
  const origin = request.origin as CloudFrontOrigin;
  const s3Origin = origin.s3 as CloudFrontS3Origin;
  const isHTMLPage = isStaticPage || isPrerenderedPage;
  const normalizedS3DomainName = normaliseS3OriginDomain(s3Origin);

  s3Origin.domainName = normalizedS3DomainName;

  if (isHTMLPage || isPublicFile) {
    s3Origin.path = isHTMLPage ? '/static-pages' : '/public';

    if (isHTMLPage) {
      addS3HostHeader(request, normalizedS3DomainName);
      request.uri = `${uri}.html`;
    }

    return request;
  }

  const pagePath = router(manifest)(uri);

  if (pagePath.endsWith('.html')) {
    s3Origin.path = '/static-pages';
    request.uri = pagePath.replace('pages', '');
    addS3HostHeader(request, normalizedS3DomainName);
    return request;
  }

  // eslint-disable-next-line
  const page = require(`./${pagePath}`);

  const { req, res, responsePromise } = lambdaAtEdgeCompat(event.Records[0].cf);

  if (isDataRequest(uri)) {
    const { renderOpts } = await page.renderReqToHTML(req, res, 'passthrough');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(renderOpts.pageData));
  } else {
    page.render(req, res);
  }

  return responsePromise;
};
