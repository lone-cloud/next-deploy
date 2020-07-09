const mockCloudFront = jest.fn();
const mockCreateInvalidation = jest.fn();
const cloudfront = jest.fn(() => {
  const cloudFront = mockCloudFront;
  cloudFront.init = () => {};
  cloudFront.default = () => {};
  cloudFront.context = {};
  return cloudFront;
});

cloudfront.mockCreateInvalidation = mockCreateInvalidation;
cloudfront.mockCloudFront = mockCloudFront;
cloudfront.createInvalidation = mockCreateInvalidation;

module.exports = cloudfront;
