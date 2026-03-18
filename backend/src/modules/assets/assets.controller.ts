import {
  Controller,
  Delete,
  Get,
  Query,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { extname } from 'node:path';
import { lookup as getMimeType } from 'mime-types';
import { AssetsService } from './assets.service';
import { StorageService } from '../storage/storage.service';

@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly storageService: StorageService
  ) {}

  @Get()
  findAll(
    @Query('assetType') assetType?: string,
    @Query('mediaType') mediaType?: string,
    @Query('bizType') bizType?: string,
    @Query('taskId') taskId?: string,
    @Query('keyword') keyword?: string
  ) {
    return this.assetsService.findMany({
      assetType,
      mediaType,
      bizType,
      taskId,
      keyword
    });
  }

  @Get('debug/summary')
  getDebugSummary() {
    return this.assetsService.getDebugSummary();
  }

  @Get('health/storage')
  checkStorage() {
    return this.storageService.checkConnection();
  }

  @Get(':id/content')
  async getContent(@Param('id') id: string, @Res() res: Response) {
    const asset = await this.assetsService.findContent(id);
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(asset.fileName)}"`);
    res.send(asset.buffer);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.assetsService.remove(id);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded.');
    }

    const extension = extname(file.originalname);
    const objectKey = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
    const mimeType = file.mimetype || getMimeType(file.originalname) || 'application/octet-stream';

    await this.storageService.uploadBuffer(objectKey, file.buffer, {
      'Content-Type': String(mimeType)
    });

    return this.assetsService.createAssetRecord({
      userId: BigInt(1),
      assetType: 'input',
      mediaType: String(file.mimetype || '').startsWith('image/') ? 'image' : 'image',
      objectKey,
      fileName: file.originalname,
      mimeType: String(mimeType),
      fileSize: BigInt(file.size)
    });
  }
}
