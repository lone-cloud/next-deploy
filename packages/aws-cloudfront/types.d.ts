export type CloudFrontInputs = {
  region?: string;
  enabled?: boolean;
  comment?: string;
  origins: string[] | Origin[];
  defaults?: PathPatternConfig;
};

type PathPatternConfig = {
  allowedHttpMethods: string[];
  ttl: number;
  compress: boolean;
  smoothStreaming: boolean;
  viewerProtocolPolicy: string;
  fieldLevelEncryptionId: string;
  forward: Forward;
  [path: string]: any;
};

type Origin = {
  url: string;
  private?: boolean;
  pathPatterns?: Record<string, PathPatternConfig>;
};

type Forward = {
  cookies?: string[];
  queryString?: string;
  headers?: string[];
  queryStringCacheKeys?: string[];
};
