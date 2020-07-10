import fse from 'fs-extra';
import path from 'path';

import { mockDomain } from '@next-deploy/aws-domain';
import { mockS3 } from '@next-deploy/aws-s3';
import { mockLambda, mockLambdaPublish } from '@next-deploy/aws-lambda';
import { mockCloudFront } from '@next-deploy/aws-cloudfront';

import NextjsComponent, { DEFAULT_LAMBDA_CODE_DIR, API_LAMBDA_CODE_DIR } from '../src/component';
import { getDomains } from '../src/utils';
import { cleanupFixtureDirectory } from './test-utils';

const createNextComponent = (inputs) => {
  const component = new NextjsComponent(inputs);
  component.context.credentials = {
    aws: {
      accessKeyId: '123',
      secretAccessKey: '456',
    },
  };
  return component;
};

const mockAwsComponentDependencies = ({ expectedDomain }) => {
  mockS3.mockResolvedValue({
    name: 'bucket-xyz',
  });

  mockLambda.mockResolvedValue({
    arn: 'arn:aws:lambda:us-east-1:123456789012:function:my-func',
  });

  mockLambdaPublish.mockResolvedValue({
    version: 'v1',
  });

  mockCloudFront.mockResolvedValueOnce({
    url: 'https://cloudfrontdistrib.amazonaws.com',
  });

  mockDomain.mockResolvedValueOnce({
    domains: [expectedDomain],
  });
};

describe('Custom inputs', () => {
  let componentOutputs;
  let consoleWarnSpy;

  beforeEach(() => {
    const realFseRemove = fse.remove.bind({});
    jest.spyOn(fse, 'remove').mockImplementation((filePath) => {
      // don't delete mocked .next/ files as they're needed for the tests and committed to source control
      if (!filePath.includes('.next' + path.sep)) {
        return realFseRemove(filePath);
      }
    });

    consoleWarnSpy = jest.spyOn(console, 'warn').mockReturnValue();
  });

  afterEach(() => {
    fse.remove.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe.each`
    inputRegion    | expectedRegion
    ${undefined}   | ${'us-east-1'}
    ${'eu-west-2'} | ${'eu-west-2'}
  `(`When input region is $inputRegion`, ({ inputRegion, expectedRegion }) => {
    const fixturePath = path.join(__dirname, './fixtures/generic-fixture');
    let tmpCwd;

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockAwsComponentDependencies({});

      const component = createNextComponent({});

      componentOutputs = await component({
        bucketRegion: inputRegion,
      });
    });

    afterEach(() => {
      process.chdir(tmpCwd);
      return cleanupFixtureDirectory(fixturePath);
    });

    it(`passes the ${expectedRegion} region to s3 component`, () => {
      expect(mockS3).toBeCalledWith(
        expect.objectContaining({
          region: expectedRegion,
        })
      );
    });
  });

  describe.each`
    inputDomains                  | expectedDomain
    ${['dev', 'example.com']}     | ${'https://dev.example.com'}
    ${['www', 'example.com']}     | ${'https://www.example.com'}
    ${'example.com'}              | ${'https://www.example.com'}
    ${[undefined, 'example.com']} | ${'https://www.example.com'}
    ${'example.com'}              | ${'https://www.example.com'}
  `('Custom domain', ({ inputDomains, expectedDomain }) => {
    const fixturePath = path.join(__dirname, './fixtures/generic-fixture');
    let tmpCwd;

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockAwsComponentDependencies({
        expectedDomain,
      });

      const component = createNextComponent({});

      componentOutputs = await component({
        policy: 'arn:aws:iam::aws:policy/CustomRole',
        domain: inputDomains,
        description: 'Custom description',
        memory: 512,
      });
    });

    afterEach(() => {
      process.chdir(tmpCwd);
      return cleanupFixtureDirectory(fixturePath);
    });

    it('uses domain to provision custom domain', () => {
      const { domain, subdomain } = getDomains(inputDomains);

      expect(mockDomain).toBeCalledWith({
        defaultCloudfrontInputs: {},
        domainType: 'both',
        privateZone: false,
        domain,
        subdomains: {
          [subdomain as string]: {
            url: 'https://cloudfrontdistrib.amazonaws.com',
          },
        },
      });
    });

    it('uses custom policy document provided', () => {
      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('Custom description'),
          role: expect.objectContaining({
            policy: {
              arn: 'arn:aws:iam::aws:policy/CustomRole',
            },
          }),
        })
      );
    });

    it('outputs custom domain url', () => {
      expect(componentOutputs.appUrl).toEqual(expectedDomain);
    });
  });

  describe.each([
    [undefined, { defaultMemory: 512, apiMemory: 512 }],
    [{}, { defaultMemory: 512, apiMemory: 512 }],
    [1024, { defaultMemory: 1024, apiMemory: 1024 }],
    [{ defaultLambda: 1024 }, { defaultMemory: 1024, apiMemory: 512 }],
    [{ apiLambda: 2048 }, { defaultMemory: 512, apiMemory: 2048 }],
    [
      { defaultLambda: 128, apiLambda: 2048 },
      { defaultMemory: 128, apiMemory: 2048 },
    ],
  ])('Lambda memory input', (inputMemory, expectedMemory) => {
    const fixturePath = path.join(__dirname, './fixtures/generic-fixture');
    let tmpCwd;

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockAwsComponentDependencies({});

      const component = createNextComponent({
        memory: inputMemory,
      });

      componentOutputs = await component({
        memory: inputMemory,
      });
    });

    afterEach(() => {
      process.chdir(tmpCwd);
      return cleanupFixtureDirectory(fixturePath);
    });

    it(`sets default lambda memory to ${expectedMemory.defaultMemory} and api lambda memory to ${expectedMemory.apiMemory} `, () => {
      const { defaultMemory, apiMemory } = expectedMemory;

      // default Lambda
      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, DEFAULT_LAMBDA_CODE_DIR),
          memory: defaultMemory,
        })
      );

      // api Lambda
      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, API_LAMBDA_CODE_DIR),
          memory: apiMemory,
        })
      );
    });
  });

  describe.each`
    inputTimeout                            | expectedTimeout
    ${undefined}                            | ${{ defaultTimeout: 10, apiTimeout: 10 }}
    ${{}}                                   | ${{ defaultTimeout: 10, apiTimeout: 10 }}
    ${40}                                   | ${{ defaultTimeout: 40, apiTimeout: 40 }}
    ${{ defaultLambda: 20 }}                | ${{ defaultTimeout: 20, apiTimeout: 10 }}
    ${{ apiLambda: 20 }}                    | ${{ defaultTimeout: 10, apiTimeout: 20 }}
    ${{ defaultLambda: 15, apiLambda: 20 }} | ${{ defaultTimeout: 15, apiTimeout: 20 }}
  `('Input timeout options', ({ inputTimeout, expectedTimeout }) => {
    let tmpCwd;
    const fixturePath = path.join(__dirname, './fixtures/generic-fixture');

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockAwsComponentDependencies({});

      const component = createNextComponent({});

      componentOutputs = await component({
        timeout: inputTimeout,
      });
    });

    afterEach(() => {
      process.chdir(tmpCwd);
      return cleanupFixtureDirectory(fixturePath);
    });

    it(`sets default lambda timeout to ${expectedTimeout.defaultTimeout} and api lambda timeout to ${expectedTimeout.apiTimeout} `, () => {
      const { defaultTimeout, apiTimeout } = expectedTimeout;

      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, DEFAULT_LAMBDA_CODE_DIR),
          timeout: defaultTimeout,
        })
      );

      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, API_LAMBDA_CODE_DIR),
          timeout: apiTimeout,
        })
      );
    });
  });

  describe.each`
    inputRuntime                                                | expectedRuntime
    ${undefined}                                                | ${{ defaultRuntime: 'nodejs12.x', apiRuntime: 'nodejs12.x' }}
    ${{}}                                                       | ${{ defaultRuntime: 'nodejs12.x', apiRuntime: 'nodejs12.x' }}
    ${'nodejs10.x'}                                             | ${{ defaultRuntime: 'nodejs10.x', apiRuntime: 'nodejs10.x' }}
    ${{ defaultLambda: 'nodejs10.x' }}                          | ${{ defaultRuntime: 'nodejs10.x', apiRuntime: 'nodejs12.x' }}
    ${{ apiLambda: 'nodejs10.x' }}                              | ${{ defaultRuntime: 'nodejs12.x', apiRuntime: 'nodejs10.x' }}
    ${{ defaultLambda: 'nodejs10.x', apiLambda: 'nodejs10.x' }} | ${{ defaultRuntime: 'nodejs10.x', apiRuntime: 'nodejs10.x' }}
  `('Input runtime options', ({ inputRuntime, expectedRuntime }) => {
    let tmpCwd;
    const fixturePath = path.join(__dirname, './fixtures/generic-fixture');

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockAwsComponentDependencies({});

      const component = createNextComponent({});

      componentOutputs = await component({
        runtime: inputRuntime,
      });
    });

    afterEach(() => {
      process.chdir(tmpCwd);
      return cleanupFixtureDirectory(fixturePath);
    });

    it(`sets default lambda runtime to ${expectedRuntime.defaultRuntime} and api lambda runtime to ${expectedRuntime.apiRuntime} `, () => {
      const { defaultRuntime, apiRuntime } = expectedRuntime;

      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, DEFAULT_LAMBDA_CODE_DIR),
          runtime: defaultRuntime,
        })
      );

      expect(mockLambda).toBeCalledWith(
        expect.objectContaining({
          code: path.join(fixturePath, API_LAMBDA_CODE_DIR),
          runtime: apiRuntime,
        })
      );
    });
  });

  describe.each`
    inputName                                                     | expectedName
    ${undefined}                                                  | ${{ defaultName: undefined, apiName: undefined }}
    ${{}}                                                         | ${{ defaultName: undefined, apiName: undefined }}
    ${'fooFunction'}                                              | ${{ defaultName: 'fooFunction', apiName: 'fooFunction' }}
    ${{ defaultLambda: 'fooFunction' }}                           | ${{ defaultName: 'fooFunction', apiName: undefined }}
    ${{ apiLambda: 'fooFunction' }}                               | ${{ defaultName: undefined, apiName: 'fooFunction' }}
    ${{ defaultLambda: 'fooFunction', apiLambda: 'barFunction' }} | ${{ defaultName: 'fooFunction', apiName: 'barFunction' }}
  `('Lambda name input', ({ inputName, expectedName }) => {
    let tmpCwd;
    const fixturePath = path.join(__dirname, './fixtures/generic-fixture');

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockAwsComponentDependencies({});

      const component = createNextComponent({});

      componentOutputs = await component({
        name: inputName,
      });
    });

    afterEach(() => {
      process.chdir(tmpCwd);
      return cleanupFixtureDirectory(fixturePath);
    });

    it(`sets default lambda name to ${expectedName.defaultName} and api lambda name to ${expectedName.apiName} `, () => {
      const { defaultName, apiName } = expectedName;

      const expectedDefaultObject = {
        code: path.join(fixturePath, DEFAULT_LAMBDA_CODE_DIR),
      };
      if (defaultName) expectedDefaultObject.name = defaultName;

      expect(mockLambda).toBeCalledWith(expect.objectContaining(expectedDefaultObject));

      const expectedApiObject = {
        code: path.join(fixturePath, API_LAMBDA_CODE_DIR),
      };
      if (apiName) expectedApiObject.name = apiName;

      expect(mockLambda).toBeCalledWith(expect.objectContaining(expectedApiObject));
    });
  });

  describe.each([
    // no input
    [undefined, {}],
    // empty input
    [{}, {}],
    // ignores origin-request and origin-response triggers as they're reserved by us
    [
      {
        defaults: {
          ttl: 500,
          'lambda@edge': {
            'origin-request': 'ignored',
            'origin-response': 'also ignored',
          },
        },
      },
      { defaults: { ttl: 500 } },
    ],
    // allow lamdba@edge triggers other than origin-request and origin-response
    [
      {
        defaults: {
          ttl: 500,
          'lambda@edge': {
            'viewer-request': 'used value',
          },
        },
      },
      {
        defaults: {
          ttl: 500,
          'lambda@edge': { 'viewer-request': 'used value' },
        },
      },
    ],
    [
      {
        defaults: {
          forward: { cookies: 'all', headers: 'X', queryString: true },
        },
      },
      {
        defaults: {
          forward: { cookies: 'all', headers: 'X', queryString: true },
        },
      },
    ],
    // ignore custom lambda@edge origin-request trigger set on the api cache behaviour
    [
      {
        'api/*': {
          ttl: 500,
          'lambda@edge': { 'origin-request': 'ignored value' },
        },
      },
      { 'api/*': { ttl: 500 } },
    ],
    // allow other lambda@edge triggers on the api cache behaviour
    [
      {
        'api/*': {
          ttl: 500,
          'lambda@edge': { 'origin-response': 'used value' },
        },
      },
      {
        'api/*': {
          ttl: 500,
          'lambda@edge': { 'origin-response': 'used value' },
        },
      },
    ],
    // custom origins and expanding relative URLs to full S3 origin
    [
      {
        origins: [
          'http://some-origin',
          '/relative',
          { url: 'http://diff-origin' },
          { url: '/diff-relative' },
        ],
      },
      {
        origins: [
          'http://some-origin',
          'http://bucket-xyz.s3.amazonaws.com/relative',
          { url: 'http://diff-origin' },
          { url: 'http://bucket-xyz.s3.amazonaws.com/diff-relative' },
        ],
      },
    ],
    // custom page cache behaviours
    [
      {
        '/terms': {
          ttl: 5500,
          'misc-param': 'misc-value',
          'lambda@edge': {
            'origin-request': 'ignored value',
          },
        },
      },
      {
        '/terms': {
          ttl: 5500,
          'misc-param': 'misc-value',
        },
      },
    ],
    [
      {
        '/customers/stan-sack': {
          ttl: 5500,
        },
      },
      {
        '/customers/stan-sack': {
          ttl: 5500,
        },
      },
    ],
  ])('Custom cloudfront inputs', (inputCloudfrontConfig, expectedInConfig) => {
    let tmpCwd;
    const fixturePath = path.join(__dirname, './fixtures/generic-fixture');
    const { origins = [], defaults = {}, ...other } = expectedInConfig;

    const expectedDefaultCacheBehaviour = {
      ...defaults,
      'lambda@edge': {
        'origin-request': 'arn:aws:lambda:us-east-1:123456789012:function:my-func:v1',
        ...defaults['lambda@edge'],
      },
    };

    const expectedApiCacheBehaviour = {
      ...expectedInConfig['api/*'],
      allowedHttpMethods: ['HEAD', 'DELETE', 'POST', 'GET', 'OPTIONS', 'PUT', 'PATCH'],
      'lambda@edge': {
        ...(expectedInConfig['api/*'] && expectedInConfig['api/*']['lambda@edge']),
        'origin-request': 'arn:aws:lambda:us-east-1:123456789012:function:my-func:v1',
      },
    };

    const customPageCacheBehaviours = {};
    Object.entries(other).forEach(([path, cacheBehaviour]) => {
      customPageCacheBehaviours[path] = {
        ...cacheBehaviour,
        'lambda@edge': {
          'origin-request': 'arn:aws:lambda:us-east-1:123456789012:function:my-func:v1',
          ...(cacheBehaviour && cacheBehaviour['lambda@edge']),
        },
      };
    });

    const cloudfrontConfig = {
      defaults: {
        ttl: 0,
        allowedHttpMethods: ['HEAD', 'GET'],
        forward: {
          cookies: 'all',
          queryString: true,
        },
        compress: true,
        ...expectedDefaultCacheBehaviour,
      },
      origins: [
        {
          pathPatterns: {
            ...customPageCacheBehaviours,
            '_next/static/*': {
              ...customPageCacheBehaviours['_next/static/*'],
              ttl: 86400,
              forward: {
                headers: 'none',
                cookies: 'none',
                queryString: false,
              },
            },
            '_next/data/*': {
              ttl: 0,
              allowedHttpMethods: ['HEAD', 'GET'],
              'lambda@edge': {
                'origin-request': 'arn:aws:lambda:us-east-1:123456789012:function:my-func:v1',
              },
            },
            'api/*': {
              ttl: 0,
              ...expectedApiCacheBehaviour,
            },
            'static/*': {
              ...customPageCacheBehaviours['static/*'],
              ttl: 86400,
              forward: {
                headers: 'none',
                cookies: 'none',
                queryString: false,
              },
            },
          },
          private: true,
          url: 'http://bucket-xyz.s3.amazonaws.com',
        },
        ...origins,
      ],
    };

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockAwsComponentDependencies({});

      const component = createNextComponent({});

      componentOutputs = await component({
        cloudfront: inputCloudfrontConfig,
      });
    });

    afterEach(() => {
      process.chdir(tmpCwd);
      return cleanupFixtureDirectory(fixturePath);
    });

    it('Sets cloudfront options if present', () => {
      expect(mockCloudFront).toBeCalledWith(expect.objectContaining(cloudfrontConfig));
    });
  });

  describe.each`
    cloudFrontInput                                | expectedErrorMessage
    ${{ 'some-invalid-page-route': { ttl: 100 } }} | ${'Could not find next.js pages for "some-invalid-page-route"'}
    ${{ '/api': { ttl: 100 } }}                    | ${'route "/api" is not supported'}
    ${{ api: { ttl: 100 } }}                       | ${'route "api" is not supported'}
    ${{ 'api/test': { ttl: 100 } }}                | ${'route "api/test" is not supported'}
  `('Invalid cloudfront inputs', ({ cloudFrontInput, expectedErrorMessage }) => {
    const fixturePath = path.join(__dirname, './fixtures/generic-fixture');
    let tmpCwd;

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockAwsComponentDependencies({});
    });

    afterEach(() => {
      process.chdir(tmpCwd);
      return cleanupFixtureDirectory(fixturePath);
    });

    it('throws the correct error', async () => {
      expect.assertions(1);

      try {
        await createNextComponent({})({
          cloudfront: cloudFrontInput,
        });
      } catch (err) {
        expect(err.message).toContain(expectedErrorMessage);
      }
    });
  });

  describe('Build using serverless trace target', () => {
    const fixturePath = path.join(__dirname, './fixtures/simple-app');
    let tmpCwd;

    beforeEach(async () => {
      tmpCwd = process.cwd();
      process.chdir(fixturePath);

      mockAwsComponentDependencies({});
    });

    afterEach(() => {
      process.chdir(tmpCwd);
      return cleanupFixtureDirectory(fixturePath);
    });

    it('builds correctly', async () => {
      await createNextComponent({})({});
    });
  });
});
