export type Role = {
  name?: string;
  region?: string;
  policy?: Policy;
  service?: string | string[];
  arn?: string;
};

type Policy = {
  arn: string;
};
