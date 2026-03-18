'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type FeatureField = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'assetImage';
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
  task?: {
    taskNo?: string;
    bizType?: string;
  };
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

type PickerFilter = {
  key: string;
  assetType?: string;
  bizType?: string;
  label: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
const ACTIVE_STATUSES = new Set(['queued', 'running', 'pending']);

function getPickerConfig(featureCode: string) {
  if (featureCode === 'fenjingtu-splitter') {
    return {
      mode: 'single' as const,
      defaultFilter: 'fenjingtu-output',
      filters: [
        { key: 'fenjingtu-output', label: '只看分镜图生成结果', assetType: 'output', bizType: 'fenjingtu' },
        { key: 'all-output', label: '看全部输出图', assetType: 'output' },
        { key: 'all-images', label: '看全部图片' }
      ] as PickerFilter[]
    };
  }

  return {
    mode: 'multiple' as const,
    defaultFilter: 'input-images',
    filters: [
      { key: 'input-images', label: '只看上传图', assetType: 'input' },
      { key: 'all-images', label: '看全部图片' }
    ] as PickerFilter[]
  };
}

export function FeatureForm({ feature, initialTasks }: Props) {
  const initialValues = useMemo(
    () =>
      feature.fields.reduce<Record<string, string>>((acc, field) => {
        if (field.type !== 'assetImage') {
          acc[field.key] = field.defaultValue || '';
        }
        return acc;
      }, {}),
    [feature.fields]
  );

  const pickerConfig = useMemo(() => getPickerConfig(feature.code), [feature.code]);

  const [title, setTitle] = useState(feature.name);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [tasks, setTasks] = useState<FeatureTask[]>(initialTasks);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedTask, setSelectedTask] = useState<FeatureTask | null>(initialTasks[0] ?? null);
  const pollingRef = useRef<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<Array<{ id: string; fileName: string; url: string; task?: { taskNo?: string; bizType?: string }; assetType: string }>>([]);
  const [selectedReferenceAssets, setSelectedReferenceAssets] = useState<Array<{ id: string; fileName: string; url: string }>>([]);
  const [taskAssets, setTaskAssets] = useState<Record<string, AssetItem[]>>({});
  const [previewAsset, setPreviewAsset] = useState<{ url: string; fileName: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFilterKey, setPickerFilterKey] = useState(pickerConfig.defaultFilter);
  const [pickerKeyword, setPickerKeyword] = useState('');

  function updateValue(key: string, value: string) {
    setValues((prev) => ({
      ...prev,
      [key]: value
    }));
  }

  function getCurrentFilter() {
    return pickerConfig.filters.find((item) => item.key === pickerFilterKey) || pickerConfig.filters[0];
  }

  async function loadAssets(params?: { assetType?: string; bizType?: string; keyword?: string; taskId?: string }) {
    const searchParams = new URLSearchParams();
    searchParams.set('mediaType', 'image');

    if (params?.assetType) {
      searchParams.set('assetType', params.assetType);
    }
    if (params?.bizType) {
      searchParams.set('bizType', params.bizType);
    }
    if (params?.keyword) {
      searchParams.set('keyword', params.keyword);
    }
    if (params?.taskId) {
      searchParams.set('taskId', params.taskId);
    }

    const response = await fetch(`${apiBaseUrl}/assets?${searchParams.toString()}`, { cache: 'no-store' });
    if (!response.ok) {
      return [] as AssetItem[];
    }

    return (await response.json()) as AssetItem[];
  }

  async function loadAssetsByTask(taskId: string) {
    return loadAssets({ taskId });
  }

  function getInputAssetsForTask(taskId: string) {
    return (taskAssets[taskId] || []).filter((asset) => asset.assetType === 'input');
  }

  function getOutputAssetsForTask(taskId: string) {
    return (taskAssets[taskId] || []).filter((asset) => asset.assetType === 'output');
  }

  async function refreshAvailableReferenceAssets(filterKey = pickerFilterKey, keyword = pickerKeyword) {
    const filter = pickerConfig.filters.find((item) => item.key === filterKey) || pickerConfig.filters[0];
    const assets = await loadAssets({
      assetType: filter.assetType,
      bizType: filter.bizType,
      keyword
    });

    setAvailableAssets(
      assets.map((asset) => ({
        id: asset.id,
        fileName: asset.fileName,
        url: asset.url,
        assetType: asset.assetType,
        task: asset.task
      }))
    );
  }

  function toggleReferenceAsset(asset: { id: string; fileName: string; url: string }) {
    if (pickerConfig.mode === 'single') {
      setSelectedReferenceAssets([asset]);
      setPickerOpen(false);
      return;
    }

    setSelectedReferenceAssets((prev) => {
      const exists = prev.some((item) => item.id === asset.id);
      if (exists) {
        return prev.filter((item) => item.id !== asset.id);
      }
      return [...prev, asset];
    });
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
      const nextAsset = {
        id: String(asset.id),
        fileName: asset.fileName,
        url: asset.url
      };

      if (pickerConfig.mode === 'single') {
        setSelectedReferenceAssets([nextAsset]);
      } else {
        setSelectedReferenceAssets((prev) => [nextAsset, ...prev]);
      }

      await refreshAvailableReferenceAssets();
      setMessage('图片已上传到 MinIO，并已加入当前任务的参考图片选择。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '图片上传失败');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  useEffect(() => {
    void refreshAvailableReferenceAssets(pickerConfig.defaultFilter, '');
    setPickerFilterKey(pickerConfig.defaultFilter);
  }, [pickerConfig.defaultFilter]);

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
  }, [selectedTask?.id, selectedTask?.status, selectedTask?.progress, selectedTask?.resultSummary?.imageCount]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const referenceImageUrls = selectedReferenceAssets.map((asset) => asset.url);
      const referenceImageIds = selectedReferenceAssets.map((asset) => asset.id);

      const response = await fetch(`${apiBaseUrl}/features/${feature.code}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          inputParams: {
            ...values,
            referenceImageIds,
            referenceImageUrls
          }
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
                <p className="text-sm font-medium text-ink">参考图片</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">点击“选择图片”打开资产选择器，按功能自动应用推荐筛选规则。</p>
              </div>
              <div className="flex gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-2xl bg-brand px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700">
                  {uploading ? '上传中...' : '上传图片'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    void refreshAvailableReferenceAssets();
                    setPickerOpen(true);
                  }}
                  className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                >
                  选择图片
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {selectedReferenceAssets.length === 0 ? (
                <p className="text-sm text-slate-400">当前还没有选中参考图片。</p>
              ) : (
                selectedReferenceAssets.map((asset) => (
                  <div key={asset.id} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.url} alt={asset.fileName} className="h-14 w-14 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-700">{asset.fileName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleReferenceAsset(asset)}
                      className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                    >
                      移除
                    </button>
                  </div>
                ))
              )}
            </div>
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

            {feature.fields
              .filter((field) => field.type !== 'assetImage')
              .map((field) => {
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
            <p className="text-sm text-slate-500">{message || '参考图片选择器会根据功能自动切换默认筛选规则。'}</p>
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
            <p className="mt-2 text-sm leading-6 text-slate-500">用于确认参考图 URL 是否真的进入了提交给 ComfyUI 的最终 prompt。</p>
          </div>
          {selectedTask ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{selectedTask.taskNo}</span> : null}
        </div>

        {!selectedTask ? (
          <div className="mt-6 text-sm text-slate-500">请选择一条任务查看调试信息。</div>
        ) : (
          <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-ink">输入图片</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {getInputAssetsForTask(selectedTask.id).length === 0 ? (
                    <p className="text-slate-400">当前任务没有绑定输入图片。</p>
                  ) : (
                    getInputAssetsForTask(selectedTask.id).map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setPreviewAsset({ url: asset.url, fileName: asset.fileName })}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-blue-300"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.url} alt={asset.fileName} className="h-40 w-full object-cover" />
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-ink">输出图片</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {getOutputAssetsForTask(selectedTask.id).length === 0 ? (
                    <p className="text-slate-400">当前任务还没有同步到平台资产中的结果图片。</p>
                  ) : (
                    getOutputAssetsForTask(selectedTask.id).map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setPreviewAsset({ url: asset.url, fileName: asset.fileName })}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-blue-300"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.url} alt={asset.fileName} className="h-40 w-full object-cover" />
                      </button>
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

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6" onClick={() => setPickerOpen(false)}>
          <div className="max-h-full w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-ink">选择参考图片</h3>
                  <p className="mt-1 text-sm text-slate-500">{pickerConfig.mode === 'single' ? '当前功能只支持单选一张图片。' : '当前功能支持多选参考图。'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                >
                  关闭
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {pickerConfig.filters.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => {
                        setPickerFilterKey(filter.key);
                        void refreshAvailableReferenceAssets(filter.key, pickerKeyword);
                      }}
                      className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                        pickerFilterKey === filter.key ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={pickerKeyword}
                    onChange={(event) => setPickerKeyword(event.target.value)}
                    placeholder="搜索文件名或任务编号"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => void refreshAvailableReferenceAssets(pickerFilterKey, pickerKeyword)}
                    className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                  >
                    搜索
                  </button>
                </div>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-auto p-5">
              {availableAssets.length === 0 ? (
                <div className="text-sm text-slate-500">当前筛选条件下没有可选图片。</div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {availableAssets.map((asset) => {
                    const checked = selectedReferenceAssets.some((item) => item.id === asset.id);

                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => toggleReferenceAsset(asset)}
                        className={`overflow-hidden rounded-2xl border text-left transition ${
                          checked ? 'border-brand bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.url} alt={asset.fileName} className="aspect-square w-full object-cover" />
                        <div className="space-y-1 p-3 text-xs text-slate-500">
                          <p className="truncate text-sm font-medium text-ink">{asset.fileName}</p>
                          <p>{asset.assetType}</p>
                          <p>{asset.task?.bizType || '-'}</p>
                          <p>{asset.task?.taskNo || '-'}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {previewAsset ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6" onClick={() => setPreviewAsset(null)}>
          <div className="max-h-full max-w-6xl overflow-auto rounded-3xl bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="truncate text-sm font-medium text-ink">图片预览</p>
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
              >
                关闭
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewAsset.url} alt={previewAsset.fileName} className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
