import { Component } from '@serverless/core';
import { exists, readJSON } from 'fs-extra';
import { resolve, join } from 'path';

import Builder from 'aws-lambda-builder';
import { OriginRequestDefaultHandlerManifest as BuildManifest } from 'aws-lambda-builder/types';
import { uploadStaticAssets } from 'aws-s3-utils';
import AwsCloudFront from 'aws-cloudfront';
import { getDomains } from './utils';
import { BuildOptions, AwsComponentInputs, LambdaType, LambdaInput } from '../types';

export const DEFAULT_LAMBDA_CODE_DIR = '.serverless_nextjs/default-lambda';
export const API_LAMBDA_CODE_DIR = '.serverless_nextjs/api-lambda';

class AwsComponent extends Component {
  async default(inputs: AwsComponentInputs = {}): Promise<any> {
    // @ts-ignore
    if (inputs.build !== false) {
      await this.build(inputs);
    }

    return this.deploy(inputs);
  }

  readDefaultBuildManifest(nextConfigPath: string): Promise<any> {
    return readJSON(join(nextConfigPath, '.serverless_nextjs/default-lambda/manifest.json'));
  }

  validatePathPatterns(pathPatterns: string[], buildManifest: BuildManifest): void {
    const stillToMatch = new Set(pathPatterns);

    if (stillToMatch.size !== pathPatterns.length) {
      throw Error('Duplicate path declared in cloudfront configuration');
    }

    // there wont be pages for these paths for this so we can remove them
    stillToMatch.delete('api/*');
    stillToMatch.delete('static/*');
    stillToMatch.delete('_next/static/*');

    // check for other api like paths
    for (const path of stillToMatch) {
      if (/^(\/?api\/.*|\/?api)$/.test(path)) {
        throw Error(`Setting custom cache behaviour for api/ route "${path}" is not supported`);
      }
    }

    // setup containers for the paths we're going to be matching against

    // for dynamic routes
    const manifestRegex: RegExp[] = [];
    // for static routes
    const manifestPaths = new Set();

    // extract paths to validate against from build manifest
    const ssrDynamic = buildManifest.pages.ssr.dynamic || {};
    const ssrNonDynamic = buildManifest.pages.ssr.nonDynamic || {};
    const htmlDynamic = buildManifest.pages.html.dynamic || {};
    const htmlNonDynamic = buildManifest.pages.html.nonDynamic || {};

    // dynamic paths to check. We use their regex to match against our input yaml
    Object.entries({
      ...ssrDynamic,
      ...htmlDynamic,
    }).map(([, { regex }]) => {
      manifestRegex.push(new RegExp(regex));
    });

    // static paths to check
    Object.entries({
      ...ssrNonDynamic,
      ...htmlNonDynamic,
    }).map(([path]) => {
      manifestPaths.add(path);
    });

    // first we check if the path patterns match any of the dynamic page regex.
    // paths with stars (*) shouldn't cause any issues because the regex will treat these
    // as characters.
    manifestRegex.forEach((re) => {
      for (const path of stillToMatch) {
        if (re.test(path)) {
          stillToMatch.delete(path);
        }
      }
    });

    // now we check the remaining unmatched paths against the non dynamic paths
    // and use the path as regex so that we are testing *
    for (const pathToMatch of stillToMatch) {
      for (const path of manifestPaths) {
        if (new RegExp(pathToMatch).test(path as string)) {
          stillToMatch.delete(pathToMatch);
        }
      }
    }

    if (stillToMatch.size > 0) {
      throw Error(
        `CloudFront input failed validation. Could not find next.js pages for "${[
          ...stillToMatch,
        ]}"`
      );
    }
  }

  async readApiBuildManifest(nextConfigPath: string): Promise<any> {
    const path = join(nextConfigPath, '.serverless_nextjs/api-lambda/manifest.json');

    // @ts-ignore
    return (await exists(path)) ? readJSON(path) : Promise.resolve(undefined);
  }

  async build(inputs: AwsComponentInputs = {}): Promise<void> {
    const nextConfigPath = inputs.nextConfigDir ? resolve(inputs.nextConfigDir) : process.cwd();

    const buildConfig: BuildOptions = {
      enabled: inputs.build
        ? // @ts-ignore
          inputs.build !== false && inputs.build.enabled !== false
        : true,
      cmd: 'node_modules/.bin/next',
      args: ['build'],
      ...(typeof inputs.build === 'object' ? inputs.build : {}),
      cwd: inputs.build && inputs.build.cwd ? resolve(inputs.build.cwd) : nextConfigPath,
    };

    if (buildConfig.enabled) {
      const builder = new Builder(nextConfigPath, join(nextConfigPath, '.serverless_nextjs'), {
        cmd: buildConfig.cmd,
        cwd: buildConfig.cwd,
        args: buildConfig.args,
      });

      await builder.build(this.context.instance.debugMode);
    }
  }

  async deploy(
    inputs: AwsComponentInputs = {}
  ): Promise<{
    appUrl: string;
    bucketName: string;
  }> {
    const nextConfigPath = inputs.nextConfigDir ? resolve(inputs.nextConfigDir) : process.cwd();

    const nextStaticPath = inputs.nextStaticDir ? resolve(inputs.nextStaticDir) : nextConfigPath;

    const customCloudFrontConfig = inputs.cloudfront || {};

    const [defaultBuildManifest, apiBuildManifest] = await Promise.all([
      this.readDefaultBuildManifest(nextConfigPath),
      this.readApiBuildManifest(nextConfigPath),
    ]);

    const [bucket, cloudFront, defaultEdgeLambda, apiEdgeLambda] = await Promise.all([
      this.load('@serverless/aws-s3'),
      this.load('aws-cloudfront'),
      this.load('aws-lambda', 'defaultEdgeLambda'),
      this.load('aws-lambda', 'apiEdgeLambda'),
    ]);

    const bucketOutputs = await bucket({
      accelerated: true,
      name: inputs.bucketName,
      region: inputs.bucketRegion || 'us-east-1',
    });

    await uploadStaticAssets({
      bucketName: bucketOutputs.name,
      nextConfigDir: nextConfigPath,
      nextStaticDir: nextStaticPath,
      credentials: this.context.credentials.aws,
      publicDirectoryCache: inputs.publicDirectoryCache,
    });

    defaultBuildManifest.cloudFrontOrigins = {
      staticOrigin: {
        domainName: `${bucketOutputs.name}.s3.amazonaws.com`,
      },
    };

    const bucketUrl = `http://${bucketOutputs.name}.s3.amazonaws.com`;

    // If origin is relative path then prepend the bucketUrl
    // e.g. /path => http://bucket.s3.aws.com/path
    const expandRelativeUrls = (origin: string | Record<string, unknown>) => {
      const originUrl = typeof origin === 'string' ? origin : (origin.url as string);
      const fullOriginUrl = originUrl.charAt(0) === '/' ? `${bucketUrl}${originUrl}` : originUrl;

      if (typeof origin === 'string') {
        return fullOriginUrl;
      } else {
        return {
          ...origin,
          url: fullOriginUrl,
        };
      }
    };

    // parse origins from inputs
    let inputOrigins: any[] = [];
    if (inputs.cloudfront && inputs.cloudfront.origins) {
      const origins = inputs.cloudfront.origins as string[];
      inputOrigins = origins.map(expandRelativeUrls);
      delete inputs.cloudfront.origins;
    }

    const cloudFrontOrigins = [
      {
        url: bucketUrl,
        private: true,
        pathPatterns: {
          '_next/static/*': {
            ttl: 86400,
            forward: {
              headers: 'none',
              cookies: 'none',
              queryString: false,
            },
          },
          'static/*': {
            ttl: 86400,
            forward: {
              headers: 'none',
              cookies: 'none',
              queryString: false,
            },
          },
        },
      },
      ...inputOrigins,
    ];

    const hasAPIPages =
      apiBuildManifest &&
      (Object.keys(apiBuildManifest.apis.nonDynamic).length > 0 ||
        Object.keys(apiBuildManifest.apis.dynamic).length > 0);

    const getLambdaMemory = (lambdaType: LambdaType) =>
      typeof inputs.memory === 'number'
        ? inputs.memory
        : (inputs.memory && inputs.memory[lambdaType]) || 512;

    const getLambdaTimeout = (lambdaType: LambdaType) =>
      typeof inputs.timeout === 'number'
        ? inputs.timeout
        : (inputs.timeout && inputs.timeout[lambdaType]) || 10;

    const getLambdaName = (lambdaType: LambdaType) =>
      typeof inputs.name === 'string' ? inputs.name : inputs.name && inputs.name[lambdaType];

    const getLambdaRuntime = (lambdaType: LambdaType) =>
      typeof inputs.runtime === 'string'
        ? inputs.runtime
        : (inputs.runtime && inputs.runtime[lambdaType]) || 'nodejs12.x';

    if (hasAPIPages) {
      const apiEdgeLambdaInput: LambdaInput = {
        description: inputs.description
          ? `${inputs.description} (API)`
          : 'API Lambda@Edge for Next CloudFront distribution',
        handler: 'index.handler',
        code: join(nextConfigPath, API_LAMBDA_CODE_DIR),
        role: {
          service: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com'],
          policy: {
            arn:
              inputs.policy || 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          },
        },
        memory: getLambdaMemory('apiLambda'),
        timeout: getLambdaTimeout('apiLambda'),
        runtime: getLambdaRuntime('apiLambda'),
      };
      const apiLambdaName = getLambdaName('apiLambda');
      if (apiLambdaName) apiEdgeLambdaInput.name = apiLambdaName;

      const apiEdgeLambdaOutputs = await apiEdgeLambda(apiEdgeLambdaInput);

      const apiEdgeLambdaPublishOutputs = await apiEdgeLambda.publishVersion();

      cloudFrontOrigins[0].pathPatterns['api/*'] = {
        ttl: 0,
        allowedHttpMethods: ['HEAD', 'DELETE', 'POST', 'GET', 'OPTIONS', 'PUT', 'PATCH'],
        // lambda@edge key is last and therefore cannot be overridden
        'lambda@edge': {
          'origin-request': `${apiEdgeLambdaOutputs.arn}:${apiEdgeLambdaPublishOutputs.version}`,
        },
      };
    }

    const defaultEdgeLambdaInput: LambdaInput = {
      description: inputs.description || 'Default Lambda@Edge for Next CloudFront distribution',
      handler: 'index.handler',
      code: join(nextConfigPath, DEFAULT_LAMBDA_CODE_DIR),
      role: {
        service: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com'],
        policy: {
          arn: inputs.policy || 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        },
      },
      memory: getLambdaMemory('defaultLambda'),
      timeout: getLambdaTimeout('defaultLambda'),
      runtime: getLambdaRuntime('defaultLambda'),
    };
    const defaultLambdaName = getLambdaName('defaultLambda');
    if (defaultLambdaName) defaultEdgeLambdaInput.name = defaultLambdaName;

    const defaultEdgeLambdaOutputs = await defaultEdgeLambda(defaultEdgeLambdaInput);

    const defaultEdgeLambdaPublishOutputs = await defaultEdgeLambda.publishVersion();

    let defaultCloudfrontInputs;
    if (inputs.cloudfront && inputs.cloudfront.defaults) {
      defaultCloudfrontInputs = inputs.cloudfront.defaults;
      delete inputs.cloudfront.defaults;
    } else {
      defaultCloudfrontInputs = {};
    }

    // validate that the custom config paths match generated paths in the manifest
    this.validatePathPatterns(Object.keys(customCloudFrontConfig), defaultBuildManifest);

    // Add any custom cloudfront configuration
    // this includes overrides for _next, static and api
    Object.entries(customCloudFrontConfig).map(([path, config]) => {
      const edgeConfig = {
        ...(config['lambda@edge'] || {}),
      };

      // here we are removing configs that cannot be overridden
      if (path === 'api/*') {
        // for "api/*" we need to make sure we aren't overriding the predefined lambda handler
        // delete is idempotent so it's safe
        delete edgeConfig['origin-request'];
      } else if (!['static/*', '_next/*'].includes(path)) {
        // for everything but static/* and _next/* we want to ensure that they are pointing at our lambda
        edgeConfig[
          'origin-request'
        ] = `${defaultEdgeLambdaOutputs.arn}:${defaultEdgeLambdaPublishOutputs.version}`;
      }

      cloudFrontOrigins[0].pathPatterns[path] = {
        // spread the existing value if there is one
        ...cloudFrontOrigins[0].pathPatterns[path],
        // spread custom config
        ...config,
        'lambda@edge': {
          // spread the provided value
          ...(cloudFrontOrigins[0].pathPatterns[path] &&
            cloudFrontOrigins[0].pathPatterns[path]['lambda@edge']),
          // then overrides
          ...edgeConfig,
        },
      };
    });

    cloudFrontOrigins[0].pathPatterns['_next/data/*'] = {
      ttl: 0,
      allowedHttpMethods: ['HEAD', 'GET'],
      'lambda@edge': {
        'origin-request': `${defaultEdgeLambdaOutputs.arn}:${defaultEdgeLambdaPublishOutputs.version}`,
      },
    };

    // make sure that origin-response is not set.
    // this is reserved for serverless-next.js usage
    const defaultLambdaAtEdgeConfig = {
      ...(defaultCloudfrontInputs['lambda@edge'] || {}),
    };
    delete defaultLambdaAtEdgeConfig['origin-response'];

    const cloudFrontOutputs = await cloudFront({
      defaults: {
        ttl: 0,
        ...defaultCloudfrontInputs,
        forward: {
          cookies: 'all',
          queryString: true,
          ...defaultCloudfrontInputs.forward,
        },
        // everything after here cant be overridden
        allowedHttpMethods: ['HEAD', 'GET'],
        'lambda@edge': {
          ...defaultLambdaAtEdgeConfig,
          'origin-request': `${defaultEdgeLambdaOutputs.arn}:${defaultEdgeLambdaPublishOutputs.version}`,
        },
        compress: true,
      },
      origins: cloudFrontOrigins,
    });

    let appUrl = cloudFrontOutputs.url;

    await AwsCloudFront.createInvalidation({
      distributionId: cloudFrontOutputs.id,
      credentials: this.context.credentials.aws,
    });

    const { domain, subdomain } = getDomains(inputs.domain);

    if (domain && subdomain) {
      const domainComponent = await this.load('aws-domain');
      const domainOutputs = await domainComponent({
        privateZone: false,
        domain,
        subdomains: {
          [subdomain]: cloudFrontOutputs,
        },
        domainType: inputs.domainType || 'both',
        defaultCloudfrontInputs,
      });
      appUrl = domainOutputs.domains[0];
    }

    return {
      appUrl,
      bucketName: bucketOutputs.name,
    };
  }

  async remove(): Promise<void> {
    const [bucket, cloudfront, domain] = await Promise.all([
      this.load('@serverless/aws-s3'),
      this.load('aws-cloudfront'),
      this.load('aws-domain'),
    ]);

    await Promise.all([bucket.remove(), cloudfront.remove(), domain.remove()]);
  }
}

export default AwsComponent;
