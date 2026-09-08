import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private bucketInitialized = false;

  constructor() {
    this.bucketName = env.S3_BUCKET_NAME;

    const s3Config: ConstructorParameters<typeof S3Client>[0] = {
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    };

    if (env.S3_ENDPOINT) {
      s3Config.endpoint = env.S3_ENDPOINT;
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
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
        this.bucketInitialized = true;
        logger.info({ bucket: this.bucketName }, 'Storage bucket created successfully.');
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
      ContentType: mimeType,
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

    const response = await this.s3Client.send(command);

    return {
      stream: response.Body as Readable,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
    };
  }

  /**
   * Generates a presigned URL for downloading a file directly from S3 / MinIO.
   */
  public async getPresignedDownloadUrl(
    storageKey: string,
    expiresInSeconds = 3600
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Deletes an object from S3 / MinIO object storage.
   */
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
