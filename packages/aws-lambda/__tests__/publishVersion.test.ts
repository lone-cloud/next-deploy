import {
  mockCreateFunctionPromise,
  mockPublishVersion,
  mockPublishVersionPromise,
  mockGetFunctionConfigurationPromise,
  mockUpdateFunctionCodePromise,
  mockUpdateFunctionConfigurationPromise,
} from 'aws-sdk';

import { createComponent, createTmpDir } from './test-utils';

jest.mock('aws-sdk', () => require('../__mocks__/aws-sdk.mock'));

const mockIamRole = jest.fn();
jest.mock('@serverless/aws-iam-role', () =>
  jest.fn(() => {
    const iamRole = mockIamRole;
    iamRole.init = () => {};
    iamRole.default = () => {};
    iamRole.context = {};
    return iamRole;
  })
);

describe('publishVersion', () => {
  let component;

  beforeEach(async () => {
    mockIamRole.mockResolvedValue({
      arn: 'arn:aws:iam::123456789012:role/xyz',
    });
    mockCreateFunctionPromise.mockResolvedValueOnce({
      FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:my-func',
      CodeSha256: 'LQT0VA=',
    });

    component = await createComponent();
  });

  it('publishes new version of lambda that was created', async () => {
    mockGetFunctionConfigurationPromise.mockRejectedValueOnce({
      code: 'ResourceNotFoundException',
    });
    mockPublishVersionPromise.mockResolvedValueOnce({
      Version: 'v2',
    });
    const tmpFolder = await createTmpDir();

    await component({
      code: tmpFolder,
    });

    const versionResult = await component.publishVersion();

    expect(mockPublishVersion).toBeCalledWith({
      FunctionName: expect.any(String),
      CodeSha256: 'LQT0VA=',
    });

    expect(versionResult).toEqual({
      version: 'v2',
    });
  });

  it('publishes new version of lambda that was updated', async () => {
    mockPublishVersionPromise.mockResolvedValue({
      Version: 'v2',
    });
    mockGetFunctionConfigurationPromise.mockRejectedValueOnce({
      code: 'ResourceNotFoundException',
    });
    mockGetFunctionConfigurationPromise.mockResolvedValueOnce({
      FunctionName: 'my-func',
    });
    mockUpdateFunctionCodePromise.mockResolvedValueOnce({
      FunctionName: 'my-func',
    });
    mockCreateFunctionPromise.mockResolvedValueOnce({
      CodeSha256: 'LQT0VA=',
    });
    mockUpdateFunctionConfigurationPromise.mockResolvedValueOnce({
      CodeSha256: 'XYZ0VA=',
    });

    const tmpFolder = await createTmpDir();

    await component.default({
      code: tmpFolder,
    });

    await component.default({
      code: tmpFolder,
    });

    const versionResult = await component.publishVersion();

    expect(mockPublishVersion).toBeCalledWith({
      FunctionName: expect.any(String),
      CodeSha256: 'XYZ0VA=', // compare against the hash received from the function update, *not* create
    });

    expect(versionResult).toEqual({
      version: 'v2',
    });
  });
});
