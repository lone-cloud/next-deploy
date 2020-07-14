export type CloudFrontInputs = {
  region?: string;
  enabled?: boolean;
  comment?: string;
  origins: string[] | Origin[];
  defaults?: PathPatternConfig;
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
  cookies?: string;
  queryString?: boolean;
  'lambda@edge'?: LambdaAtEdgeConfig;
};

type ViewerCertificate = {
  ACMCertificateArn: string;
  SSLSupportMethod: string;
  minimumProtocolVersion: string;
  certificate: string;
  certificateSource: string;
};

type LambdaAtEdgeConfig = {
  [type: string]: LambdaAtEdgeType;
};

type LambdaAtEdgeType =
  | string
  | {
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
  cookies?: string[];
  queryString?: string;
  headers?: string[];
  queryStringCacheKeys?: string[];
};
