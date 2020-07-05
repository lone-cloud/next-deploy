import { CloudFront } from 'aws-sdk';
import url from 'url';

import { Origin } from '../../types';

const getOriginConfig = (origin: Origin, { originAccessIdentityId = '' }) => {
  const originUrl = typeof origin === 'string' ? origin : origin.url;

  const { hostname, pathname } = url.parse(originUrl);

  const originConfig: CloudFront.Origin = {
    Id: hostname as string,
    DomainName: hostname as string,
    CustomHeaders: {
      Quantity: 0,
      Items: [],
    },
    OriginPath: pathname === '/' ? '' : (pathname as string),
  };

  if (originUrl.includes('s3')) {
    const bucketName = (hostname as string).split('.')[0];
    originConfig.Id = bucketName;
    originConfig.DomainName = `${bucketName}.s3.amazonaws.com`;
    originConfig.S3OriginConfig = {
      OriginAccessIdentity: originAccessIdentityId
        ? `origin-access-identity/cloudfront/${originAccessIdentityId}`
        : '',
    };
  } else {
    originConfig.CustomOriginConfig = {
      HTTPPort: 80,
      HTTPSPort: 443,
      OriginProtocolPolicy: 'https-only',
      OriginSslProtocols: {
        Quantity: 1,
        Items: ['TLSv1.2'],
      },
      OriginReadTimeout: 30,
      OriginKeepaliveTimeout: 5,
    };
  }

  return originConfig;
};

export default getOriginConfig;
