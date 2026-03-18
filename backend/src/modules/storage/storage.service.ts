import { Injectable } from '@nestjs/common';
import { Client } from 'minio';

@Injectable()
export class StorageService {
  private readonly bucket = process.env.MINIO_BUCKET || 'aigc-assets';
  private bucketReady = false;
  private readonly client = new Client({
    endPoint: process.env.MINIO_ENDPOINT || '127.0.0.1',
    port: Number(process.env.MINIO_PORT || 9000),
    useSSL: (process.env.MINIO_USE_SSL || 'false') === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
  });

  private async ensureBucket() {
    if (this.bucketReady) {
      return;
    }

    try {
      const bucketExists = await this.client.bucketExists(this.bucket);

      if (!bucketExists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
      }

      this.bucketReady = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown MinIO connection error';
      throw new Error(`MinIO is not available. Please check MINIO_ENDPOINT/MINIO_PORT and ensure MinIO is running. Original error: ${message}`);
    }
  }

  getBucketName() {
    return this.bucket;
  }

  async checkConnection() {
    await this.ensureBucket();
    return {
      ok: true,
      bucket: this.bucket,
      endpoint: process.env.MINIO_ENDPOINT || '127.0.0.1',
      port: Number(process.env.MINIO_PORT || 9000)
    };
  }

  async uploadBuffer(objectKey: string, buffer: Buffer, metaData?: Record<string, string>) {
    await this.ensureBucket();
    await this.client.putObject(this.bucket, objectKey, buffer, buffer.length, metaData);
    return {
      bucketName: this.bucket,
      objectKey
    };
  }

  async getObjectBuffer(objectKey: string) {
    await this.ensureBucket();
    const stream = await this.client.getObject(this.bucket, objectKey);
    const chunks: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async deleteObject(objectKey: string) {
    await this.ensureBucket();
    await this.client.removeObject(this.bucket, objectKey);
  }
}
