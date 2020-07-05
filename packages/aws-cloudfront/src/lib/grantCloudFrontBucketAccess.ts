import { S3 } from 'aws-sdk';

const grantCloudFrontBucketAccess = (s3: S3, bucketName: string, s3CanonicalUserId: string) => {
  const policy = `
	{
		"Version":"2012-10-17",
		"Id":"PolicyForCloudFrontPrivateContent",
		"Statement":[
			{
				"Sid":" Grant a CloudFront Origin Identity access to support private content",
				"Effect":"Allow",
			"Principal":{"CanonicalUser":"${s3CanonicalUserId}"},
			"Action":"s3:GetObject",
			"Resource":"arn:aws:s3:::${bucketName}/*"
		  }
		]
	 } 
	 `;

  return s3
    .putBucketPolicy({
      Bucket: bucketName,
      Policy: policy.replace(/(\r\n|\n|\r|\t)/gm, ''),
    })
    .promise();
};

export default grantCloudFrontBucketAccess;
