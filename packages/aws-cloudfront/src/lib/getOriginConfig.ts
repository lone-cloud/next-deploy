import { CloudFront } from 'aws-sdk';
import url from 'url';

import { Origin } from '../../types';

const getOriginConfig = (origin: string | Origin, { originAccessIdentityId = '' }) => {
  const originUrl = typeof origin === 'string' ? origin : origin.url;
  const protocolPolicy = typeof origin === 'string' ? null : origin.protocolPolicy;

  const { hostname, pathname } = url.parse(originUrl);

  const originConfig: CloudFront.Origin = {
    Id: `${hostname}${pathname}`.replace(/\/$/, ''),
    DomainName: hostname as string,
    CustomHeaders: {
      Quantity: 0,
      Items: [],
    },
    OriginPath: pathname === '/' ? '' : (pathname as string),
  };

  if (originUrl.includes('s3') && !originUrl.includes('s3-website')) {
    const bucketName = (hostname as string).split('.')[0];

    originConfig.Id = pathname === '/' ? bucketName : `${bucketName}${pathname}`;
    originConfig.DomainName = hostname as string;
    originConfig.S3OriginConfig = {
      OriginAccessIdentity: originAccessIdentityId
        ? `origin-access-identity/cloudfront/${originAccessIdentityId}`
        : '',
    };
  } else {
    originConfig.CustomOriginConfig = {
      HTTPPort: 80,
      HTTPSPort: 443,
      OriginProtocolPolicy: protocolPolicy || 'https-only',
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
