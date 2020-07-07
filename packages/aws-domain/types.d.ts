import { DomainType } from '@next-deploy/aws-component/types';
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

type Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

type SubDomainType = 'awsCloudFront' | 'awsS3Website' | 'awsApiGateway' | 'awsAppSync';
