import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { lookup as getMimeType } from 'mime-types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService
  ) {}

  private buildAssetUrl(id: bigint | number | string) {
    const baseUrl = process.env.APP_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
    return `${baseUrl}/api/assets/${String(id)}/content`;
  }

  private serializeAsset(asset: any) {
    return {
      ...asset,
      id: String(asset.id),
      userId: String(asset.userId),
      taskId: asset.taskId ? String(asset.taskId) : null,
      fileSize: asset.fileSize ? String(asset.fileSize) : null,
      user: asset.user
        ? {
            ...asset.user,
            id: String(asset.user.id)
          }
        : undefined,
      task: asset.task
        ? {
            ...asset.task,
            id: String(asset.task.id)
          }
        : undefined,
      url: this.buildAssetUrl(asset.id)
    };
  }

  async findAll() {
    return this.findMany({});
  }

  async findMany(filters: {
    assetType?: string;
    mediaType?: string;
    bizType?: string;
    taskId?: string;
    keyword?: string;
  }) {
    const where: Prisma.assetsWhereInput = {
      ...(filters.assetType ? { assetType: filters.assetType } : {}),
      ...(filters.mediaType ? { mediaType: filters.mediaType } : {}),
      ...(filters.taskId ? { taskId: BigInt(filters.taskId) } : {}),
      ...(filters.bizType
        ? {
            task: {
              bizType: filters.bizType
            }
          }
        : {}),
      ...(filters.keyword
        ? {
            OR: [
              {
                fileName: {
                  contains: filters.keyword
                }
              },
              {
                task: {
                  taskNo: {
                    contains: filters.keyword
                  }
                }
              }
            ]
          }
        : {})
    };

    const assets = await this.prisma.assets.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        task: {
          select: {
            id: true,
            taskNo: true,
            title: true,
            bizType: true,
            status: true
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            nickname: true
          }
        }
      }
    });

    return assets.map((asset) => this.serializeAsset(asset));
  }

  async getDebugSummary() {
    const total = await this.prisma.assets.count();
    const latest = await this.prisma.assets.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        task: {
          select: {
            id: true,
            taskNo: true,
            bizType: true
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            nickname: true
          }
        }
      }
    });

    return {
      total,
      latest: latest.map((asset) => this.serializeAsset(asset))
    };
  }

  async findContent(id: string) {
    const asset = await this.prisma.assets.findUnique({
      where: { id: BigInt(id) }
    });

    if (!asset) {
      throw new NotFoundException('Asset not found.');
    }

    const buffer = await this.storageService.getObjectBuffer(asset.objectKey);
    return {
      buffer,
      mimeType: asset.mimeType || getMimeType(asset.fileName) || 'application/octet-stream',
      fileName: asset.fileName
    };
  }

  async remove(id: string) {
    const asset = await this.prisma.assets.findUnique({
      where: { id: BigInt(id) }
    });

    if (!asset) {
      throw new NotFoundException('Asset not found.');
    }

    await this.storageService.deleteObject(asset.objectKey);
    await this.prisma.assets.delete({
      where: { id: BigInt(id) }
    });

    return {
      success: true,
      id,
      objectKey: asset.objectKey,
      message: 'Asset deleted successfully.'
    };
  }

  async createAssetRecord(params: {
    userId: bigint;
    taskId?: bigint | null;
    assetType: string;
    mediaType: string;
    objectKey: string;
    fileName: string;
    mimeType?: string | null;
    fileSize?: bigint | null;
    bucketName?: string | null;
    width?: number | null;
    height?: number | null;
    duration?: number | null;
  }) {
    const asset = await this.prisma.assets.create({
      data: {
        userId: params.userId,
        taskId: params.taskId ?? null,
        assetType: params.assetType,
        mediaType: params.mediaType,
        storageProvider: 'minio',
        bucketName: params.bucketName || this.storageService.getBucketName(),
        objectKey: params.objectKey,
        fileName: params.fileName,
        mimeType: params.mimeType ?? null,
        fileSize: params.fileSize ?? null,
        width: params.width ?? null,
        height: params.height ?? null,
        duration: params.duration ?? null
      }
    });

    return this.serializeAsset(asset);
  }
}
