import { Component } from '@serverless/core';
import { readJSON } from 'fs-extra';
import { resolve, join } from 'path';

import Builder from '@next-deploy/aws-lambda-builder';
import AwsS3 from '@next-deploy/aws-s3';
import AwsCloudFront from '@next-deploy/aws-cloudfront';
import { OriginRequestHandlerManifest as BuildManifest } from '@next-deploy/aws-lambda-builder/types';
import { PathPatternConfig } from '@next-deploy/aws-cloudfront/types';
import { Origin } from '@next-deploy/aws-cloudfront/types';
import { getDomains } from './utils';
import { DeploymentResult, AwsComponentInputs, LambdaType, LambdaInput } from '../types';

export const BUILD_DIR = '.next-deploy-build';
export const REQUEST_LAMBDA_CODE_DIR = `${BUILD_DIR}/request-lambda`;

class AwsComponent extends Component {
  async default(inputs: AwsComponentInputs = {}): Promise<DeploymentResult> {
    if (inputs.buildOptions !== false) {
      await this.build(inputs);
    }

    return this.deploy(inputs);
  }

  readRequestLambdaBuildManifest(nextConfigPath: string): Promise<BuildManifest> {
    return readJSON(join(nextConfigPath, `${REQUEST_LAMBDA_CODE_DIR}/manifest.json`));
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

  async build(inputs: AwsComponentInputs = {}): Promise<void> {
    const nextConfigPath = inputs.nextConfigDir ? resolve(inputs.nextConfigDir) : process.cwd();
    const buildCwd =
      typeof inputs.buildOptions === 'boolean' ||
      typeof inputs.buildOptions === 'undefined' ||
      !inputs.buildOptions.cwd
        ? nextConfigPath
        : resolve(inputs.buildOptions.cwd);
    const buildConfig: BuildOptions = {
      enabled: inputs.buildOptions
        ? // @ts-ignore
          inputs.buildOptions !== false && inputs.buildOptions.enabled !== false
        : true,
      cmd: 'node_modules/.bin/next',
      args: ['build'],
      ...(typeof inputs.buildOptions === 'object' ? inputs.buildOptions : {}),
      cwd: buildCwd,
    };

    if (buildConfig.enabled) {
      const builder = new Builder(nextConfigPath, join(nextConfigPath, BUILD_DIR), {
        cmd: buildConfig.cmd,
        cwd: buildConfig.cwd,
        args: buildConfig.args,
      });

      await builder.build(this.context.instance.debugMode ? this.context.debug : undefined);
    }
  }

  async deploy(inputs: AwsComponentInputs = {}): Promise<DeploymentResult> {
    const nextConfigPath = inputs.nextConfigDir ? resolve(inputs.nextConfigDir) : process.cwd();

    const nextStaticPath = inputs.nextStaticDir ? resolve(inputs.nextStaticDir) : nextConfigPath;

    const customCloudFrontConfig: Record<string, any> = inputs.cloudfrontOptions || {};
    const bucketRegion = inputs.bucketRegion || 'us-east-1';

    const [defaultBuildManifest] = await Promise.all([
      this.readRequestLambdaBuildManifest(nextConfigPath),
    ]);

    const [bucket, cloudFront, requestEdgeLambda] = await Promise.all([
      this.load('@next-deploy/aws-s3'),
      this.load('@next-deploy/aws-cloudfront'),
      this.load('@next-deploy/aws-lambda', 'requestEdgeLambda'),
    ]);

    const bucketOutputs = await bucket({
      accelerated: true,
      name: inputs.bucketName,
      region: bucketRegion,
    });

    await AwsS3.uploadStaticAssets({
      bucketName: bucketOutputs.name,
      nextConfigDir: nextConfigPath,
      nextStaticDir: nextStaticPath,
      credentials: this.context.credentials.aws,
      publicDirectoryCache: inputs.publicDirectoryCache,
    });

    const bucketUrl = `http://${bucketOutputs.name}.s3.${bucketRegion}.amazonaws.com`;

    // If origin is relative path then prepend the bucketUrl
    // e.g. /path => http://bucket.s3.aws.com/path
    const expandRelativeUrls = (origin: string | Origin): string | Origin => {
      const originUrl = typeof origin === 'string' ? origin : origin.url;
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
    let inputOrigins: any = [];
    if (inputs.cloudfrontOptions && inputs.cloudfrontOptions.origins) {
      const origins = inputs.cloudfrontOptions.origins as string[];
      inputOrigins = origins.map(expandRelativeUrls);
      delete inputs.cloudfrontOptions.origins;
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

    const getLambdaInputValue = (
      inputKey: 'memory' | 'timeout' | 'name' | 'runtime' | 'description',
      lambdaType: LambdaType,
      defaultValue: string | number | undefined
    ): string | number | undefined => {
      const inputValue = inputs[inputKey];
      if (typeof inputValue === 'string' || typeof inputValue === 'number') {
        return inputValue;
      }

      if (!inputValue) {
        return defaultValue;
      }

      return inputValue[lambdaType] || defaultValue;
    };

    const defaultEdgeLambdaInput: LambdaInput = {
      handler: 'index.handler',
      code: join(nextConfigPath, REQUEST_LAMBDA_CODE_DIR),
      role: {
        service: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com'],
        policy: {
          arn: inputs.policy || 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        },
      },
      memory: getLambdaInputValue('memory', 'requestLambda', 512) as number,
      timeout: getLambdaInputValue('timeout', 'requestLambda', 10) as number,
      runtime: getLambdaInputValue('runtime', 'requestLambda', 'nodejs12.x') as string,
      name: getLambdaInputValue('name', 'requestLambda', undefined) as string | undefined,
      description: getLambdaInputValue(
        'description',
        'requestLambda',
        'Request handler for the Next CloudFront distribution.'
      ) as string,
    };

    const requestEdgeLambdaOutputs = await requestEdgeLambda(defaultEdgeLambdaInput);

    const requestEdgeLambdaPublishOutputs = await requestEdgeLambda.publishVersion();

    let defaultCloudfrontInputs = {} as PathPatternConfig;

    if (inputs.cloudfrontOptions && inputs.cloudfrontOptions.defaults) {
      defaultCloudfrontInputs = inputs.cloudfrontOptions.defaults;
      delete inputs.cloudfrontOptions.defaults;
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
        ] = `${requestEdgeLambdaOutputs.arn}:${requestEdgeLambdaPublishOutputs.version}`;
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
      forward: {
        headers: 'none',
        cookies: 'none',
        queryString: false,
      },
      allowedHttpMethods: ['HEAD', 'GET'],
      'lambda@edge': {
        'origin-request': `${requestEdgeLambdaOutputs.arn}:${requestEdgeLambdaPublishOutputs.version}`,
      },
    };

    // make sure that origin-response is not set.
    // this is reserved for our usage
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
        allowedHttpMethods: ['HEAD', 'DELETE', 'POST', 'GET', 'OPTIONS', 'PUT', 'PATCH'],
        'lambda@edge': {
          ...defaultLambdaAtEdgeConfig,
          'origin-request': `${requestEdgeLambdaOutputs.arn}:${requestEdgeLambdaPublishOutputs.version}`,
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
      const domainComponent = await this.load('@next-deploy/aws-domain');
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
      this.load('@next-deploy/aws-s3'),
      this.load('@next-deploy/aws-cloudfront'),
      this.load('@next-deploy/aws-domain'),
    ]);

    await Promise.all([bucket.remove(), cloudfront.remove(), domain.remove()]);
  }
}

export default AwsComponent;
