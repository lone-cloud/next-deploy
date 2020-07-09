const promisifyMock = (mockFn) => {
  const promise = jest.fn();
  mockFn.mockImplementation(() => ({
    promise,
  }));

  return promise;
};

export const mockCreateDistribution = jest.fn();
export const mockCreateDistributionPromise = promisifyMock(mockCreateDistribution);

export const mockUpdateDistribution = jest.fn();
export const mockUpdateDistributionPromise = promisifyMock(mockUpdateDistribution);

export const mockGetDistributionConfig = jest.fn();
export const mockGetDistributionConfigPromise = promisifyMock(mockGetDistributionConfig);

export const mockDeleteDistribution = jest.fn();
export const mockDeleteDistributionPromise = promisifyMock(mockDeleteDistribution);

export const mockCreateCloudFrontOriginAccessIdentity = jest.fn();
export const mockCreateCloudFrontOriginAccessIdentityPromise = promisifyMock(
  mockCreateCloudFrontOriginAccessIdentity
);

export const mockPutBucketPolicy = jest.fn();
export const mockPutBucketPolicyPromise = promisifyMock(mockPutBucketPolicy);

export const mockCreateInvalidation = jest.fn();
export const mockCreateInvalidationPromise = promisifyMock(mockCreateInvalidation);

export const CloudFront = jest.fn(() => ({
  createDistribution: mockCreateDistribution,
  updateDistribution: mockUpdateDistribution,
  getDistributionConfig: mockGetDistributionConfig,
  deleteDistribution: mockDeleteDistribution,
  createCloudFrontOriginAccessIdentity: mockCreateCloudFrontOriginAccessIdentity,
  createInvalidation: mockCreateInvalidation,
}));

export const S3 = jest.fn(() => ({
  putBucketPolicy: mockPutBucketPolicy,
}));
