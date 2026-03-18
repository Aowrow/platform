import { PageHeader } from '@/components/page-header';

const configs = [
  ['ComfyUI Base URL', 'http://localhost:8188'],
  ['轮询间隔', '3000ms'],
  ['默认存储桶', 'aigc-assets'],
  ['后端 API', 'http://localhost:3001/api']
];

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="系统配置"
        description="用于维护 ComfyUI 服务地址、轮询间隔和对象存储配置。"
      />

      <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-soft">
        <div className="space-y-4">
          {configs.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <span className="text-slate-500">{label}</span>
              <span className="font-medium text-ink">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
