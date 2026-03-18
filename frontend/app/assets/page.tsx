'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

type AssetItem = {
  id: string;
  assetType: string;
  mediaType: string;
  storageProvider: string;
  fileName: string;
  url: string;
  task?: {
    taskNo?: string;
    bizType?: string;
  };
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewAsset, setPreviewAsset] = useState<AssetItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadAssets() {
    const response = await fetch(`${apiBaseUrl}/assets`, { cache: 'no-store' });
    if (!response.ok) {
      setAssets([]);
      setLoading(false);
      return;
    }

    const result = (await response.json()) as AssetItem[];
    setAssets(result);
    setLoading(false);
  }

  useEffect(() => {
    void loadAssets();
  }, []);

  const imageAssets = useMemo(() => assets.filter((asset) => asset.mediaType === 'image'), [assets]);

  async function handleDelete(assetId: string) {
    const confirmed = window.confirm('确定要删除这条资产吗？删除后将同时移除 MinIO 中的对象。');
    if (!confirmed) {
      return;
    }

    setDeletingId(assetId);

    try {
      const response = await fetch(`${apiBaseUrl}/assets/${assetId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || '删除资产失败');
      }

      setAssets((prev) => prev.filter((asset) => asset.id !== assetId));
      if (previewAsset?.id === assetId) {
        setPreviewAsset(null);
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '删除资产失败');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="资产管理"
        description="统一查看上传图片和任务生成图片，当前资源统一进入 MinIO 管理。"
      />

      {loading ? (
        <div className="rounded-3xl border border-white/70 bg-white/90 p-6 text-sm text-slate-500 shadow-soft">资源加载中...</div>
      ) : imageAssets.length === 0 ? (
        <div className="rounded-3xl border border-white/70 bg-white/90 p-6 text-sm text-slate-500 shadow-soft">
          当前还没有资源数据，请先上传图片或执行生成任务。
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {imageAssets.map((asset) => (
            <div key={asset.id} className="overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-soft">
              <button type="button" onClick={() => setPreviewAsset(asset)} className="block aspect-square w-full bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.url} alt={asset.fileName} className="h-full w-full object-cover transition hover:scale-[1.02]" />
              </button>
              <div className="space-y-3 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-ink">{asset.fileName}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600">{asset.assetType}</span>
                </div>
                <div className="space-y-1 text-xs text-slate-500">
                  <p>任务：{asset.task?.taskNo || '-'}</p>
                  <p>功能：{asset.task?.bizType || '-'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewAsset(asset)}
                    className="flex-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                  >
                    查看原图
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(asset.id)}
                    disabled={deletingId === asset.id}
                    className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingId === asset.id ? '删除中' : '删除'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewAsset ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6" onClick={() => setPreviewAsset(null)}>
          <div className="max-h-full max-w-6xl overflow-auto rounded-3xl bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">{previewAsset.fileName}</p>
                <p className="text-xs text-slate-500">{previewAsset.task?.bizType || 'asset'} / {previewAsset.assetType}</p>
              </div>
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
