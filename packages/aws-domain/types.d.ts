import { DomainType } from 'aws-component/types';

type AwsDomainInputs = {
  domain: string;
  region?: string;
  privateZone?: boolean;
  domainType?: DomainType;
  defaultCloudfrontInputs?: any;
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
