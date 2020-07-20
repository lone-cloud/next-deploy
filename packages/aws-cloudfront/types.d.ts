export type CloudFrontInputs = {
  distributionId?: string;
  region?: string;
  enabled?: boolean;
  comment?: string;
  origins: string[] | Origin[];
  defaults?: PathPatternConfig;
  priceClass?: 'PriceClass_All' | 'PriceClass_200' | 'PriceClass_100';
};

type PathPatternConfig = {
  allowedHttpMethods?: string[];
  ttl?: number;
  compress?: boolean;
  smoothStreaming?: boolean;
  viewerProtocolPolicy?: string;
  fieldLevelEncryptionId?: string;
  forward?: Forward;
  viewerCertificate?: ViewerCertificate;
  'lambda@edge'?: LambdaAtEdge;
};

type ViewerCertificate = {
  ACMCertificateArn: string;
  SSLSupportMethod: string;
  minimumProtocolVersion: string;
};

type LambdaAtEdge = {
  [type: string]: string | LambdaAtEdgeConfig;
};

type LambdaAtEdgeConfig = {
  arn: string;
  includeBody: boolean;
};

type Origin = {
  url: string;
  private?: boolean;
  pathPatterns?: Record<string, PathPatternConfig>;
  protocolPolicy?: string;
};

type Forward = {
  cookies?: string | string[];
  queryString?: boolean;
  headers?: string[];
  queryStringCacheKeys?: string[];
};
