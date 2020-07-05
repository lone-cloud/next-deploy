import { CloudFront } from 'aws-sdk';

import { Credentials } from '../../types';

const ALL_FILES_PATH = '/*';

const createInvalidation = ({
  credentials,
  distributionId,
  paths = [ALL_FILES_PATH],
}: {
  credentials: Credentials;
  distributionId: string;
  paths?: string[];
}): Promise<CloudFront.CreateInvalidationResult> => {
  const cloudFront = new CloudFront({ credentials });
  const callerReference = new Date().getTime().toString();

  return cloudFront
    .createInvalidation({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: callerReference,
        Paths: {
          Quantity: paths.length,
          Items: paths,
        },
      },
    })
    .promise();
};

export default createInvalidation;
