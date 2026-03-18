import { Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { lookup as getMimeType } from 'mime-types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ComfyuiService } from '../comfyui/comfyui.service';
import { CreateFeatureTaskDto } from '../features/dto/create-feature-task.dto';
import { getFeatureDefinition, loadFeatureWorkflow } from '../features/feature-registry';
import { StorageService } from '../storage/storage.service';
import { AssetsService } from '../assets/assets.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly comfyuiService: ComfyuiService,
    private readonly storageService: StorageService,
    private readonly assetsService: AssetsService
  ) {}

  private serializeTask(task: any) {
    return {
      ...task,
      id: String(task.id),
      userId: String(task.userId),
      user: task.user
        ? {
            ...task.user,
            id: String(task.user.id)
          }
        : undefined,
      assets: Array.isArray(task.assets)
        ? task.assets.map((asset: any) => ({
            ...asset,
            id: String(asset.id),
            userId: String(asset.userId),
            taskId: asset.taskId ? String(asset.taskId) : null,
            fileSize: asset.fileSize ? String(asset.fileSize) : null
          }))
        : undefined,
      resultSummary: task.resultSummary ?? null
    };
  }

  private async appendTaskLog(taskId: bigint, logType: string, message: string, detail?: Prisma.InputJsonValue, status?: string) {
    await this.prisma.task_logs.create({
      data: {
        taskId,
        logType,
        status,
        message,
        detail
      }
    });
  }

  private async appendTaskLogIfStatusChanged(
    taskId: bigint,
    logType: string,
    message: string,
    nextStatus: string,
    detail?: Prisma.InputJsonValue
  ) {
    const lastLog = await this.prisma.task_logs.findFirst({
      where: {
        taskId,
        logType
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (lastLog?.status === nextStatus) {
      return;
    }

    await this.appendTaskLog(taskId, logType, message, detail, nextStatus);
  }

  private extractResultSummary(historyRecord: any): Prisma.InputJsonValue {
    const outputs = historyRecord?.outputs || {};
    const outputEntries = Object.values(outputs as Record<string, any>);
    const images = outputEntries.flatMap((entry: any) => entry?.images || []);
    const videos = outputEntries.flatMap((entry: any) => entry?.gifs || entry?.videos || []);
    const files = [...images, ...videos].map((item: any) => ({
      filename: item?.filename ?? null,
      subfolder: item?.subfolder ?? null,
      type: item?.type ?? null
    }));

    return {
      imageCount: images.length,
      videoCount: videos.length,
      files,
      rawOutputs: outputs
    } as Prisma.InputJsonValue;
  }

  private isPromptFinished(historyPayload: any, promptId: string) {
    return Boolean(historyPayload?.[promptId]);
  }

  private async pollTaskUntilFinished(taskId: bigint, promptId: string) {
    const comfyInfo = this.comfyuiService.getBaseInfo();
    const startAt = Date.now();

    while (Date.now() - startAt < comfyInfo.timeoutMs) {
      const historyPayload = await this.comfyuiService.getTaskResult(promptId);

      if (this.isPromptFinished(historyPayload, promptId)) {
        const historyRecord = historyPayload[promptId];
        const statusText = historyRecord?.status?.status_str || 'success';
        const success = statusText === 'success';
        const resultSummary = this.extractResultSummary(historyRecord);
        const currentTask = await this.prisma.tasks.findUnique({
          where: { id: taskId },
          select: { resultSummary: true }
        });

        await this.prisma.tasks.update({
          where: { id: taskId },
          data: {
            status: success ? 'success' : 'failed',
            progress: 100,
            finishedAt: new Date(),
            resultSummary: ({
              ...(currentTask?.resultSummary && typeof currentTask.resultSummary === 'object' ? currentTask.resultSummary : {}),
              ...(resultSummary as Record<string, unknown>)
            } as Prisma.InputJsonValue),
            errorMessage: success ? null : JSON.stringify(historyRecord?.status || {})
          }
        });

        await this.appendTaskLog(
          taskId,
          'result',
          success ? 'ComfyUI task finished successfully.' : 'ComfyUI task finished with failure.',
          historyPayload as Prisma.InputJsonValue,
          success ? 'success' : 'failed'
        );

        if (success) {
          await this.syncGeneratedAssets(taskId, historyRecord);
        }

        return;
      }

      const queuePayload = await this.comfyuiService.getQueue();
      const running = Array.isArray(queuePayload?.queue_running)
        ? queuePayload.queue_running.some((item: any[]) => item?.[1] === promptId)
        : false;
      const pendingIndex = Array.isArray(queuePayload?.queue_pending)
        ? queuePayload.queue_pending.findIndex((item: any[]) => item?.[1] === promptId)
        : -1;

      const nextStatus = running ? 'running' : pendingIndex >= 0 ? 'queued' : 'queued';
      const nextProgress = running ? 50 : pendingIndex >= 0 ? 15 : 10;

      await this.prisma.tasks.update({
        where: { id: taskId },
        data: {
          status: nextStatus,
          progress: nextProgress
        }
      });

      await this.appendTaskLogIfStatusChanged(
        taskId,
        'polling',
        'Polling ComfyUI task status.',
        nextStatus,
        queuePayload as Prisma.InputJsonValue
      );

      await new Promise((resolve) => setTimeout(resolve, comfyInfo.pollIntervalMs));
    }

    await this.prisma.tasks.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: 'ComfyUI polling timeout exceeded.'
      }
    });

    await this.appendTaskLog(
      taskId,
      'error',
      'ComfyUI polling timeout exceeded.',
      { promptId } as Prisma.InputJsonValue,
      'failed'
    );
  }

  private async syncGeneratedAssets(taskId: bigint, historyRecord: any) {
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
      select: { userId: true }
    });

    if (!task) {
      return;
    }

    const outputs = historyRecord?.outputs || {};
    const outputEntries = Object.values(outputs as Record<string, any>);
    const files = outputEntries.flatMap((entry: any) => [...(entry?.images || []), ...(entry?.gifs || []), ...(entry?.videos || [])]);
    const outputDir = process.env.COMFYUI_OUTPUT_DIR || 'D:/ComfyUI/output';

    for (const file of files) {
      const filename = file?.filename;
      if (!filename) {
        continue;
      }

      const subfolder = file?.subfolder || '';
      const localPath = subfolder ? join(outputDir, subfolder, filename) : join(outputDir, filename);
      const buffer = await readFile(localPath);
      const objectKey = `generated/${taskId.toString()}/${filename}`;
      const mimeType = String(getMimeType(filename) || 'application/octet-stream');

      await this.storageService.uploadBuffer(objectKey, buffer, {
        'Content-Type': mimeType
      });

      const existingAsset = await this.prisma.assets.findFirst({
        where: {
          taskId,
          objectKey
        }
      });

      if (!existingAsset) {
        await this.assetsService.createAssetRecord({
          userId: task.userId,
          taskId,
          assetType: 'output',
          mediaType: mimeType.startsWith('image/') ? 'image' : mimeType.startsWith('video/') ? 'video' : 'image',
          objectKey,
          fileName: filename,
          mimeType,
          fileSize: BigInt(buffer.length)
        });
      }
    }
  }

  private async getDefaultUser() {
    const defaultUser = await this.prisma.users.findFirst({
      where: { status: 1 },
      orderBy: { id: 'asc' }
    });

    if (!defaultUser) {
      throw new Error('No active user found. Please run seed data first.');
    }

    return defaultUser;
  }

  async findAll() {
    const tasks = await this.prisma.tasks.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        assets: true,
        user: {
          select: {
            id: true,
            username: true,
            nickname: true
          }
        }
      }
    });

    return tasks.map((task) => this.serializeTask(task));
  }

  async findOne(id: string) {
    const task = await this.prisma.tasks.findUnique({
      where: { id: BigInt(id) },
      include: {
        assets: true,
        taskLogs: {
          orderBy: { createdAt: 'desc' }
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

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    return {
      ...this.serializeTask(task),
      resultSummary: task.resultSummary ?? null,
      taskLogs: task.taskLogs.map((log) => ({
        ...log,
        id: String(log.id),
        taskId: String(log.taskId)
      }))
    };
  }

  async create(dto: CreateTaskDto) {
    return this.createForFeature(dto.featureCode, {
      title: dto.title,
      inputParams: dto.inputParams
    });
  }

  async createForFeature(featureCode: string, dto: CreateFeatureTaskDto) {
    const feature = getFeatureDefinition(featureCode);

    if (!feature) {
      throw new NotFoundException('Feature not found.');
    }

    const defaultUser = await this.getDefaultUser();
    const taskNo = `TASK${Date.now()}`;
    const workflow = await loadFeatureWorkflow(feature.workflowFile);
    const prompt = feature.applyInputParams(structuredClone(workflow), dto.inputParams);
    const createdTask = await this.prisma.tasks.create({
      data: {
        taskNo,
        userId: defaultUser.id,
        taskType: feature.taskType,
        bizType: feature.code,
        title: dto.title || feature.name,
        status: 'queued',
        progress: 0,
        inputParams: dto.inputParams as Prisma.InputJsonValue,
        comfyServer: this.comfyuiService.getBaseInfo().baseUrl,
        comfyWorkflowName: feature.workflowFile
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true
          }
        },
        assets: true
      }
    });

    await this.appendTaskLog(
      createdTask.id,
      'submit',
      `Feature task created for ${feature.code}, preparing to submit to ComfyUI.`,
      dto.inputParams as Prisma.InputJsonValue,
      'queued'
    );

    try {
      const submitResult = await this.comfyuiService.submitTask({ prompt });

      const updatedTask = await this.prisma.tasks.update({
        where: { id: createdTask.id },
        data: {
          comfyTaskId: submitResult.promptId,
          status: 'queued',
          progress: 5,
          startedAt: new Date(),
          resultSummary: {
            featureCode,
            queuePosition: submitResult.queuePosition ?? null,
            submittedPrompt: prompt
          }
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true
            }
          },
          assets: true
        }
      });

      await this.appendTaskLog(
        createdTask.id,
        'submit',
        `Feature ${feature.code} submitted to ComfyUI successfully.`,
        {
          submitResult: submitResult.raw,
          submittedPrompt: prompt
        } as Prisma.InputJsonValue,
        'queued'
      );

      void this.pollTaskUntilFinished(createdTask.id, submitResult.promptId).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown polling error';

        await this.prisma.tasks.update({
          where: { id: createdTask.id },
          data: {
            status: 'failed',
            finishedAt: new Date(),
            errorMessage: message
          }
        });

        await this.appendTaskLog(
          createdTask.id,
          'error',
          'Polling ComfyUI task failed.',
          { message } as Prisma.InputJsonValue,
          'failed'
        );
      });

      return this.serializeTask(updatedTask);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ComfyUI submission failed.';

      const failedTask = await this.prisma.tasks.update({
        where: { id: createdTask.id },
        data: {
          status: 'failed',
          errorMessage: message,
          finishedAt: new Date()
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true
            }
          },
          assets: true
        }
      });

      await this.appendTaskLog(
        createdTask.id,
        'error',
        `Feature ${feature.code} submission to ComfyUI failed.`,
        { message } as Prisma.InputJsonValue,
        'failed'
      );

      return this.serializeTask(failedTask);
    }
  }

  async pollNow(id: string) {
    const task = await this.prisma.tasks.findUnique({
      where: { id: BigInt(id) }
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    if (!task.comfyTaskId) {
      throw new Error('Current task has not been submitted to ComfyUI yet.');
    }

    void this.pollTaskUntilFinished(task.id, task.comfyTaskId);

    return {
      success: true,
      taskId: id,
      comfyTaskId: task.comfyTaskId,
      message: 'Manual polling has been triggered.'
    };
  }
}
