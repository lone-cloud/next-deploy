import { PathPatternConfig } from '@next-deploy/aws-cloudfront/types';

type AwsDomainInputs = {
  domain: string;
  region?: string;
  privateZone?: boolean;
  domainType?: DomainType;
  defaultCloudfrontInputs?: Partial<PathPatternConfig>;
  subdomains: SubDomain[];
};

type SubDomain = {
  id: string;
  domain: string;
  distributionId: string;
  url: string;
  type: SubDomainType;
};

type SubDomainType = 'awsCloudFront' | 'awsS3Website' | 'awsApiGateway' | 'awsAppSync';
type DomainType = 'www' | 'apex' | 'both';
