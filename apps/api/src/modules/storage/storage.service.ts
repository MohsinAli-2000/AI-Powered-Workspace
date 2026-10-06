import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  type BucketLocationConstraint,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { NotFoundError } from '../../errors/app-error.js';

export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private bucketInitialized = false;

  constructor() {
    this.bucketName = env.S3_BUCKET_NAME.trim();

    const s3Config: ConstructorParameters<typeof S3Client>[0] = {
      region: env.S3_REGION.trim(),
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID.trim(),
        secretAccessKey: env.S3_SECRET_ACCESS_KEY.trim(),
      },
    };

    const endpoint = env.S3_ENDPOINT?.trim();
    if (endpoint) {
      s3Config.endpoint = endpoint;
    }

    this.s3Client = new S3Client(s3Config);
  }

  /**
   * Ensures the configured S3 / MinIO bucket exists.
   * Auto-creates the bucket in local/development environments if missing.
   */
  public async ensureBucketExists(): Promise<void> {
    if (this.bucketInitialized) return;

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      this.bucketInitialized = true;
      logger.debug({ bucket: this.bucketName }, 'Storage bucket verified.');
    } catch (error: any) {
      // If bucket does not exist, create it (standard for MinIO local dev)
      if (
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404 ||
        error.Code === 'NoSuchBucket'
      ) {
        logger.info({ bucket: this.bucketName }, 'Bucket not found. Creating storage bucket...');
        try {
          const region = env.S3_REGION.trim();
          const createBucketParams: ConstructorParameters<typeof CreateBucketCommand>[0] = {
            Bucket: this.bucketName,
          };
          if (region && region !== 'us-east-1') {
            createBucketParams.CreateBucketConfiguration = {
              LocationConstraint: region as BucketLocationConstraint,
            };
          }
          await this.s3Client.send(new CreateBucketCommand(createBucketParams));
          this.bucketInitialized = true;
          logger.info({ bucket: this.bucketName }, 'Storage bucket created successfully.');
        } catch (createErr) {
          logger.error({ error: createErr, bucket: this.bucketName }, 'Failed to create storage bucket.');
          throw createErr;
        }
      } else if (error.$metadata?.httpStatusCode === 403 || error.name === 'Forbidden') {
        // User has PutObject/GetObject permissions but not HeadBucket/ListBucket.
        logger.warn(
          { bucket: this.bucketName },
          'Storage bucket HeadBucket returned 403 Forbidden. Proceeding under assumption bucket exists.'
        );
        this.bucketInitialized = true;
      } else {
        logger.warn({ error, bucket: this.bucketName }, 'Could not verify storage bucket.');
      }
    }
  }

  /**
   * Uploads a file buffer to S3 / MinIO object storage.
   * Returns the storageKey of the uploaded object.
   */
  public async uploadFile(
    storageKey: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<string> {
    await this.ensureBucketExists();

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
      Body: fileBuffer,
      ContentType: mimeType || 'application/octet-stream',
      ContentLength: fileBuffer.length,
    });

    await this.s3Client.send(command);

    logger.debug(
      { storageKey, sizeBytes: fileBuffer.length, mimeType },
      'File uploaded to object storage.'
    );

    return storageKey;
  }

  /**
   * Retrieves a readable stream for a file from S3 / MinIO.
   */
  public async downloadStream(storageKey: string): Promise<{
    stream: Readable;
    contentType?: string;
    contentLength?: number;
  }> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });

    try {
      const response = await this.s3Client.send(command);

      return {
        stream: response.Body as Readable,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
      };
    } catch (error: any) {
      if (
        error.name === 'NoSuchKey' ||
        error.$metadata?.httpStatusCode === 404 ||
        error.Code === 'NoSuchKey'
      ) {
        throw new NotFoundError(`File '${storageKey}' not found in storage.`);
      }
      throw error;
    }
  }

  /**
   * Generates a presigned URL for downloading a file directly from S3 / MinIO.
   */
  public async getPresignedDownloadUrl(
    storageKey: string,
    expiresInSeconds = 3600,
    originalFilename?: string
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
      ...(originalFilename
        ? {
            ResponseContentDisposition: `attachment; filename="${encodeURIComponent(originalFilename)}"`,
          }
        : {}),
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Deletes an object from S3 / MinIO object storage.
   */
  /**
   * Best-effort removal of many objects (e.g. after a project/organization delete). Never throws.
   */
  public async deleteFiles(storageKeys: string[]): Promise<void> {
    for (const key of storageKeys) {
      await this.deleteFile(key);
    }
  }

  public async deleteFile(storageKey: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
      });

      await this.s3Client.send(command);
      logger.debug({ storageKey }, 'File deleted from object storage.');
    } catch (error) {
      logger.warn({ storageKey, error }, 'Failed to delete file from object storage.');
    }
  }
}

export const storageService = new StorageService();
