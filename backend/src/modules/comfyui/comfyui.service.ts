import { Injectable } from '@nestjs/common';

type ComfyTaskPayload = {
  prompt: Record<string, unknown>;
};

type ComfySubmitResult = {
  promptId: string;
  queuePosition?: number;
  raw: unknown;
};

@Injectable()
export class ComfyuiService {
  getBaseInfo() {
    return {
      baseUrl: process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188',
      timeoutMs: Number(process.env.COMFYUI_TIMEOUT_MS || 300000),
      pollIntervalMs: Number(process.env.COMFYUI_POLL_INTERVAL_MS || 3000)
    };
  }

  async submitTask(payload: ComfyTaskPayload): Promise<ComfySubmitResult> {
    const { baseUrl, timeoutMs } = this.getBaseInfo();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: payload.prompt }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`ComfyUI submit failed with status ${response.status}`);
      }

      const data = (await response.json()) as {
        prompt_id?: string;
        number?: number;
      };

      if (!data.prompt_id) {
        throw new Error('ComfyUI response missing prompt_id');
      }

      return {
        promptId: data.prompt_id,
        queuePosition: data.number,
        raw: data
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async getTaskResult(promptId: string) {
    const { baseUrl, timeoutMs } = this.getBaseInfo();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/history/${promptId}`, {
        method: 'GET',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`ComfyUI history query failed with status ${response.status}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async getQueue() {
    const { baseUrl, timeoutMs } = this.getBaseInfo();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/queue`, {
        method: 'GET',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`ComfyUI queue query failed with status ${response.status}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}
