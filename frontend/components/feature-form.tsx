'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type FeatureField = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  description?: string;
  defaultValue?: string;
  options?: Array<{ label: string; value: string }>;
};

type ResultSummary = {
  imageCount?: number;
  videoCount?: number;
  files?: Array<{
    filename?: string | null;
    subfolder?: string | null;
    type?: string | null;
  }>;
  submittedPrompt?: Record<string, unknown>;
};

type FeatureTask = {
  id: string;
  taskNo: string;
  status: string;
  progress: number;
  title?: string | null;
  bizType?: string;
  resultSummary?: ResultSummary | null;
};

type AssetItem = {
  id: string;
  assetType: string;
  mediaType: string;
  fileName: string;
  taskId: string | null;
  url: string;
};

type FeatureData = {
  code: string;
  name: string;
  description: string;
  taskType: string;
  resultType: string;
  fields: FeatureField[];
};

type Props = {
  feature: FeatureData;
  initialTasks: FeatureTask[];
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
const ACTIVE_STATUSES = new Set(['queued', 'running', 'pending']);

export function FeatureForm({ feature, initialTasks }: Props) {
  const initialValues = useMemo(
    () =>
      feature.fields.reduce<Record<string, string>>((acc, field) => {
        acc[field.key] = field.defaultValue || '';
        return acc;
      }, {}),
    [feature.fields]
  );

  const [title, setTitle] = useState(feature.name);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [tasks, setTasks] = useState<FeatureTask[]>(initialTasks);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedTask, setSelectedTask] = useState<FeatureTask | null>(initialTasks[0] ?? null);
  const pollingRef = useRef<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedAssets, setUploadedAssets] = useState<Array<{ id: string; fileName: string; url: string }>>([]);
  const [taskAssets, setTaskAssets] = useState<Record<string, AssetItem[]>>({});

  function updateValue(key: string, value: string) {
    setValues((prev) => ({
      ...prev,
      [key]: value
    }));
  }

  async function loadAssetsByTask(taskId: string) {
    const response = await fetch(`${apiBaseUrl}/assets`, { cache: 'no-store' });
    if (!response.ok) {
      return [] as AssetItem[];
    }

    const allAssets = (await response.json()) as AssetItem[];
    return allAssets.filter((asset) => asset.taskId === taskId && asset.mediaType === 'image');
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${apiBaseUrl}/assets/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || '图片上传失败');
      }

      const asset = await response.json();
      setUploadedAssets((prev) => [
        {
          id: String(asset.id),
          fileName: asset.fileName,
          url: asset.url
        },
        ...prev
      ]);
      setMessage('图片已上传到 MinIO，并写入资产管理。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '图片上传失败');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  useEffect(() => {
    setSelectedTask((current) => {
      if (!current && tasks[0]) {
        return tasks[0];
      }

      if (!current) {
        return null;
      }

      const refreshed = tasks.find((task) => task.id === current.id);
      return refreshed || current;
    });
  }, [tasks]);

  useEffect(() => {
    async function refreshTasks() {
      const response = await fetch(`${apiBaseUrl}/tasks`, { cache: 'no-store' });
      if (!response.ok) {
        return;
      }

      const latestTasks = (await response.json()) as FeatureTask[];
      const filteredTasks = latestTasks
        .filter((task) => task.status && task.taskNo && task.id)
        .filter((task) => task.bizType === feature.code);
      setTasks(filteredTasks);
    }

    const hasActiveTask = tasks.some((task) => ACTIVE_STATUSES.has(task.status));

    if (!hasActiveTask) {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    if (!pollingRef.current) {
      pollingRef.current = window.setInterval(() => {
        void refreshTasks();
      }, 3000);
    }

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [tasks, feature.code]);

  useEffect(() => {
    async function syncSelectedTaskAssets() {
      if (!selectedTask?.id) {
        return;
      }

      const assets = await loadAssetsByTask(selectedTask.id);
      setTaskAssets((prev) => ({
        ...prev,
        [selectedTask.id]: assets
      }));
    }

    void syncSelectedTaskAssets();
  }, [selectedTask?.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const response = await fetch(`${apiBaseUrl}/features/${feature.code}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          inputParams: values
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || '功能任务创建失败');
      }

      const createdTask = await response.json();
      const nextTask = {
        id: String(createdTask.id),
        taskNo: createdTask.taskNo,
        status: createdTask.status,
        progress: createdTask.progress,
        title: createdTask.title,
        bizType: createdTask.bizType,
        resultSummary: createdTask.resultSummary ?? null
      };

      setTasks((prev) => [nextTask, ...prev]);
      setSelectedTask(nextTask);
      setMessage('任务已提交到后端，并开始调用 ComfyUI。页面会自动刷新任务状态。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '任务提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-6 overflow-x-hidden">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleSubmit} className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-soft">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Feature Form</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">{feature.name}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{feature.description}</p>
          </div>

          <div className="mb-6 rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-ink">上传参考图片</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">上传后的图片会进入 MinIO，并在资产管理页可见。</p>
              </div>
              <label className="inline-flex cursor-pointer items-center rounded-2xl bg-brand px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700">
                {uploading ? '上传中...' : '上传图片'}
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            {uploadedAssets.length > 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {uploadedAssets.slice(0, 4).map((asset) => (
                  <div key={asset.id} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.url} alt={asset.fileName} className="h-14 w-14 rounded-xl object-cover" />
                    <p className="truncate text-sm text-slate-600">{asset.fileName}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4">
            <label className="grid gap-2 text-sm text-slate-600">
              <span>任务标题</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand"
              />
            </label>

            {feature.fields.map((field) => {
              const commonClassName = 'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand';

              return (
                <label key={field.key} className="grid gap-2 text-sm text-slate-600">
                  <span>{field.label}</span>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={values[field.key] || ''}
                      onChange={(event) => updateValue(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      rows={7}
                      required={field.required}
                      className={commonClassName}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={values[field.key] || ''}
                      onChange={(event) => updateValue(field.key, event.target.value)}
                      className={commonClassName}
                    >
                      {(field.options || []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={values[field.key] || ''}
                      onChange={(event) => updateValue(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                      className={commonClassName}
                    />
                  )}
                  {field.description ? <span className="text-xs leading-5 text-slate-400">{field.description}</span> : null}
                </label>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">{message || '这里只暴露新手真正需要修改的参数，底层工作流仍由后端绑定。'}</p>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-2xl bg-brand px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting ? '提交中...' : '开始生成'}
            </button>
          </div>
        </form>

        <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-semibold text-ink">最近任务</h3>
            <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Auto Refresh</span>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-4 border-b border-slate-100 pb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            <span>任务编号</span>
            <span>标题</span>
            <span>状态</span>
            <span>进度</span>
          </div>
          <div className="divide-y divide-slate-100">
            {tasks.length === 0 ? (
              <div className="py-8 text-sm text-slate-500">当前还没有该功能的任务记录。</div>
            ) : (
              tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedTask(task)}
                  className="grid w-full grid-cols-4 gap-4 py-4 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <span className="truncate">{task.taskNo}</span>
                  <span className="truncate">{task.title || '-'}</span>
                  <span>{task.status}</span>
                  <span>{task.progress}%</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="min-w-0 rounded-3xl border border-white/70 bg-white/90 p-6 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-ink">任务调试信息</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">用于确认前端输入是否真的影响了发送给 ComfyUI 的最终 prompt。</p>
          </div>
          {selectedTask ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{selectedTask.taskNo}</span> : null}
        </div>

        {!selectedTask ? (
          <div className="mt-6 text-sm text-slate-500">请选择一条任务查看调试信息。</div>
        ) : (
          <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-ink">任务结果图片</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {(taskAssets[selectedTask.id] || []).length === 0 ? (
                    <p className="text-slate-400">当前任务还没有同步到平台资产中的结果图片。</p>
                  ) : (
                    taskAssets[selectedTask.id].map((asset) => (
                      <div key={asset.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.url} alt={asset.fileName} className="h-40 w-full object-cover" />
                        <div className="p-3 text-xs text-slate-500">{asset.fileName}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>状态</span>
                  <strong className="text-ink">{selectedTask.status}</strong>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span>进度</span>
                  <strong className="text-ink">{selectedTask.progress}%</strong>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-ink">输出摘要</p>
                <p className="mt-3">图片数量：{selectedTask.resultSummary?.imageCount ?? 0}</p>
                <p>视频数量：{selectedTask.resultSummary?.videoCount ?? 0}</p>
                <div className="mt-3 space-y-2">
                  {(selectedTask.resultSummary?.files || []).length === 0 ? (
                    <p className="text-slate-400">当前还没有记录到输出文件。</p>
                  ) : (
                    selectedTask.resultSummary?.files?.map((file, index) => (
                      <div key={`${file.filename || 'file'}-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-xs text-slate-500">{file.subfolder || 'root'} / {file.type || 'output'}</p>
                        <p className="mt-1 break-all text-sm text-ink">{file.filename || '-'}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">提交到 ComfyUI 的最终 Prompt</p>
              <pre className="mt-3 max-h-[520px] min-w-0 overflow-x-auto overflow-y-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100 whitespace-pre-wrap break-words">
                {JSON.stringify(selectedTask.resultSummary?.submittedPrompt || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
