import { Route53, ACM, CloudFront, Credentials } from 'aws-sdk';
import { utils } from '@serverless/core';

import { PathPatternConfig } from '@next-deploy/aws-cloudfront/types';
import { DomainType } from '@next-deploy/aws-component/types';
import { AwsDomainInputs, SubDomain } from '../types';

const DEFAULT_MINIMUM_PROTOCOL_VERSION = 'TLSv1.2_2018';
const HOSTED_ZONE_ID = 'Z2FDTNDATAQYW2'; // this is a constant that you can get from here https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-route53-aliastarget.html

/**
 * Get Clients
 * - Gets AWS SDK clients to use within this Component
 */
export const getClients = (
  credentials: Credentials,
  region = 'us-east-1'
): { route53: Route53; acm: ACM; cf: CloudFront } => {
  const route53 = new Route53({
    credentials,
    region,
  });

  const acm = new ACM({
    credentials,
    region: 'us-east-1', // ACM must be in us-east-1
  });

  const cf = new CloudFront({
    credentials,
    region,
  });

  return {
    route53,
    acm,
    cf,
  };
};

/**
 * Prepare Domains
 * - Formats component domains & identifies cloud services they're using.
 */
export const prepareSubdomains = (inputs: AwsDomainInputs): SubDomain[] => {
  const subdomains = [];

  for (const subdomain in inputs.subdomains || {}) {
    const domainObj: Partial<SubDomain> = {};

    domainObj.domain = `${subdomain}.${inputs.domain}`;

    if (inputs.subdomains[subdomain].url.includes('cloudfront')) {
      domainObj.distributionId = inputs.subdomains[subdomain].id;
      domainObj.url = inputs.subdomains[subdomain].url;
      domainObj.type = 'awsCloudFront';
    }

    subdomains.push(domainObj);
  }

  return subdomains as SubDomain[];
};

/**
 * Get Domain Hosted Zone ID
 * - Every Domain on Route53 always has a Hosted Zone w/ 2 Record Sets.
 * - These Record Sets are: "Name Servers (NS)" & "Start of Authority (SOA)"
 * - These don't need to be created and SHOULD NOT be modified.
 */
export const getDomainHostedZoneId = async (
  route53: Route53,
  domain: string,
  privateZone: boolean
): Promise<string> => {
  const hostedZonesRes = await route53.listHostedZonesByName().promise();

  const hostedZone = hostedZonesRes.HostedZones.find(
    // Name has a period at the end, so we're using includes rather than equals
    (zone) => zone?.Config?.PrivateZone === privateZone && zone.Name.includes(domain)
  );

  if (!hostedZone) {
    throw Error(
      `Domain ${domain} was not found in your AWS account. Please purchase it from Route53 first then try again.`
    );
  }

  return hostedZone.Id.replace('/hostedzone/', ''); // hosted zone id is always prefixed with this :(
};

/**
 * Describe Certificate By Arn
 * - Describe an AWS ACM Certificate by its ARN
 */
export const describeCertificateByArn = async (
  acm: ACM,
  certificateArn: string
): Promise<ACM.CertificateDetail | null> => {
  const certificate = await acm.describeCertificate({ CertificateArn: certificateArn }).promise();
  return certificate && certificate.Certificate ? certificate.Certificate : null;
};

/**
 * Get Certificate Arn By Domain
 * - Gets an AWS ACM Certificate by a specified domain or return null
 */
export const getCertificateArnByDomain = async (
  acm: ACM,
  domain: string
): Promise<string | null> => {
  const listRes = await acm.listCertificates().promise();

  if (!listRes.CertificateSummaryList) {
    throw new Error('Could not get a list of certificates');
  }

  for (const certificate of listRes.CertificateSummaryList) {
    if (certificate.DomainName === domain && certificate.CertificateArn) {
      if (domain.startsWith('www.')) {
        const nakedDomain = domain.replace('wwww.', '');
        // check whether certificate support naked domain
        const certDetail = await describeCertificateByArn(acm, certificate.CertificateArn);

        if (!certDetail?.DomainValidationOptions) {
          throw new Error('Could not get a domain validation options');
        }

        const nakedDomainCert = certDetail.DomainValidationOptions.find(
          ({ DomainName }) => DomainName === nakedDomain
        );

        if (!nakedDomainCert) {
          continue;
        }
      }

      return certificate.CertificateArn;
    }
  }

  return null;
};

/**
 * Create Certificate
 * - Creates an AWS ACM Certificate for the specified domain
 */
export const createCertificate = async (acm: ACM, domain: string): Promise<string | undefined> => {
  const wildcardSubDomain = `*.${domain}`;

  const params = {
    DomainName: domain,
    SubjectAlternativeNames: [domain, wildcardSubDomain],
    ValidationMethod: 'DNS',
  };

  const res = await acm.requestCertificate(params).promise();

  return res.CertificateArn;
};

/**
 * Validate Certificate
 * - Validate an AWS ACM Certificate via the "DNS" method
 */
export const validateCertificate = async (
  acm: ACM,
  route53: Route53,
  certificate: ACM.CertificateDetail,
  domain: string,
  domainHostedZoneId: string
): Promise<void> => {
  let readinessCheckCount = 16;
  let statusCheckCount = 16;

  /**
   * Check Readiness
   * - Newly Created AWS ACM Certificates may not yet have the info needed to validate it
   * - Specifically, the "ResourceRecord" object in the Domain Validation Options
   * - Ensure this exists.
   */
  const checkReadiness = async function (): Promise<ACM.ResourceRecord> {
    if (readinessCheckCount < 1) {
      throw new Error(
        'Your newly created AWS ACM Certificate is taking a while to initialize.  Please try running this component again in a few minutes.'
      );
    }

    const cert = await describeCertificateByArn(acm, certificate.CertificateArn as string);

    if (!cert?.DomainValidationOptions) {
      throw new Error(`Could not get a certificate by ${certificate.CertificateArn}`);
    }

    // Find root domain validation option resource record
    cert.DomainValidationOptions.forEach((option) => {
      if (domain === option.DomainName && option.ResourceRecord) {
        return option.ResourceRecord;
      }
    });

    readinessCheckCount--;
    await utils.sleep(5000);

    return await checkReadiness();
  };

  const validationResourceRecord = await checkReadiness();

  const checkRecordsParams = {
    HostedZoneId: domainHostedZoneId,
    MaxItems: '10',
    StartRecordName: validationResourceRecord.Name,
  };

  // Check if the validation resource record sets already exist.
  // This might be the case if the user is trying to deploy multiple times while validation is occurring.
  const existingRecords = await route53.listResourceRecordSets(checkRecordsParams).promise();

  if (!existingRecords.ResourceRecordSets.length) {
    // Create CNAME record for DNS validation check
    // NOTE: It can take 30 minutes or longer for DNS propagation so validation can complete, just continue on and don't wait for this...
    const recordParams = {
      HostedZoneId: domainHostedZoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: validationResourceRecord.Name,
              Type: validationResourceRecord.Type,
              TTL: 300,
              ResourceRecords: [
                {
                  Value: validationResourceRecord.Value,
                },
              ],
            },
          },
        ],
      },
    };

    await route53.changeResourceRecordSets(recordParams).promise();
  }

  /**
   * Check Validated Status
   * - Newly Validated AWS ACM Certificates may not yet show up as valid
   * - This gives them some time to update their status.
   */
  const checkStatus = async function (): Promise<void> {
    if (statusCheckCount < 1) {
      throw new Error(
        'Your newly validated AWS ACM Certificate is taking a while to register as valid.  Please try running this component again in a few minutes.'
      );
    }

    const cert = await describeCertificateByArn(acm, certificate.CertificateArn as string);

    if (cert?.Status !== 'ISSUED') {
      statusCheckCount--;
      await utils.sleep(10000);
      return await checkStatus();
    }
  };

  await checkStatus();
};

/**
 * Configure DNS records for a distribution domain
 */
export const configureDnsForCloudFrontDistribution = async (
  route53: Route53,
  subdomain: SubDomain,
  domainHostedZoneId: string,
  distributionUrl: string,
  domainType: DomainType
): Promise<Route53.ChangeResourceRecordSetsResponse> => {
  const dnsRecordParams = {
    HostedZoneId: domainHostedZoneId,
    ChangeBatch: {
      Changes: [],
    },
  };

  // don't create www records for apex mode
  if (!subdomain.domain.startsWith('www.') || domainType !== 'apex') {
    dnsRecordParams.ChangeBatch.Changes.push({
      Action: 'UPSERT',
      ResourceRecordSet: {
        Name: subdomain.domain,
        Type: 'A',
        AliasTarget: {
          HostedZoneId: HOSTED_ZONE_ID,
          DNSName: distributionUrl,
          EvaluateTargetHealth: false,
        },
      },
    } as never);
  }

  // don't create apex records for www mode
  if (subdomain.domain.startsWith('www.') && domainType !== 'www') {
    dnsRecordParams.ChangeBatch.Changes.push({
      Action: 'UPSERT',
      ResourceRecordSet: {
        Name: subdomain.domain.replace('www.', ''),
        Type: 'A',
        AliasTarget: {
          HostedZoneId: HOSTED_ZONE_ID,
          DNSName: distributionUrl,
          EvaluateTargetHealth: false,
        },
      },
    } as never);
  }

  return route53.changeResourceRecordSets(dnsRecordParams).promise();
};

/**
 * Remove AWS CloudFront Website DNS Records
 */
export const removeCloudFrontDomainDnsRecords = async (
  route53: Route53,
  domain: string,
  domainHostedZoneId: string,
  distributionUrl: string
): Promise<void> => {
  const params = {
    HostedZoneId: domainHostedZoneId,
    ChangeBatch: {
      Changes: [
        {
          Action: 'DELETE',
          ResourceRecordSet: {
            Name: domain,
            Type: 'A',
            AliasTarget: {
              HostedZoneId: HOSTED_ZONE_ID,
              DNSName: distributionUrl,
              EvaluateTargetHealth: false,
            },
          },
        },
      ],
    },
  };

  // TODO: should the CNAME records be removed too?

  try {
    await route53.changeResourceRecordSets(params).promise();
  } catch (e) {
    if (e.code !== 'InvalidChangeBatch') {
      throw e;
    }
  }
};

export const addDomainToCloudfrontDistribution = async (
  cf: CloudFront,
  subdomain: SubDomain,
  certificateArn: string,
  domainType: DomainType,
  defaultCloudfrontInputs: Partial<PathPatternConfig>
): Promise<{
  id?: string;
  arn?: string;
  url?: string;
}> => {
  const distributionConfigResponse = await cf
    .getDistributionConfig({ Id: subdomain.distributionId })
    .promise();

  if (!distributionConfigResponse.DistributionConfig) {
    throw new Error('Could not get a distribution config');
  }

  const updateDistributionRequest = {
    IfMatch: distributionConfigResponse.ETag,
    Id: subdomain.distributionId,
    DistributionConfig: {
      ...distributionConfigResponse.DistributionConfig,
      Aliases: {
        Quantity: 1,
        Items: [subdomain.domain],
      },
      ViewerCertificate: {
        ACMCertificateArn: certificateArn,
        SSLSupportMethod: 'sni-only',
        MinimumProtocolVersion: DEFAULT_MINIMUM_PROTOCOL_VERSION,
        Certificate: certificateArn,
        CertificateSource: 'acm',
        ...defaultCloudfrontInputs.viewerCertificate,
      },
    },
  };

  if (subdomain.domain.startsWith('www.')) {
    if (domainType === 'apex') {
      updateDistributionRequest.DistributionConfig.Aliases.Items = [
        `${subdomain.domain.replace('www.', '')}`,
      ];
    } else if (domainType !== 'www') {
      updateDistributionRequest.DistributionConfig.Aliases.Quantity = 2;
      updateDistributionRequest.DistributionConfig.Aliases.Items.push(
        `${subdomain.domain.replace('www.', '')}`
      );
    }
  }

  const res = await cf.updateDistribution(updateDistributionRequest).promise();

  return {
    id: res?.Distribution?.Id,
    arn: res?.Distribution?.ARN,
    url: res?.Distribution?.DomainName,
  };
};

export const removeDomainFromCloudFrontDistribution = async (
  cf: CloudFront,
  subdomain: SubDomain
): Promise<{
  id?: string;
  arn?: string;
  url?: string;
}> => {
  const distributionConfigResponse = await cf
    .getDistributionConfig({ Id: subdomain.distributionId })
    .promise();

  if (!distributionConfigResponse.DistributionConfig) {
    throw new Error('Could not get a distribution config');
  }

  const updateDistributionRequest = {
    Id: subdomain.distributionId,
    IfMatch: distributionConfigResponse.ETag,
    DistributionConfig: {
      ...distributionConfigResponse.DistributionConfig,
      Aliases: {
        Quantity: 0,
        Items: [],
      },
      ViewerCertificate: {
        SSLSupportMethod: 'sni-only',
        MinimumProtocolVersion: DEFAULT_MINIMUM_PROTOCOL_VERSION,
      },
    },
  };

  const res = await cf.updateDistribution(updateDistributionRequest).promise();

  return {
    id: res?.Distribution?.Id,
    arn: res?.Distribution?.ARN,
    url: res?.Distribution?.DomainName,
  };
};
