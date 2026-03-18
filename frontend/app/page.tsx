import { PageHeader } from '@/components/page-header';
import { FeatureCard } from '@/components/feature-card';
import { featureCatalog } from '@/lib/feature-catalog';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

async function getFeatures() {
  try {
    const response = await fetch(`${apiBaseUrl}/features`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      return [];
    }

    return response.json();
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const remoteFeatures = await getFeatures();
  const features = remoteFeatures.length > 0 ? remoteFeatures : featureCatalog;

  return (
    <div>
      <PageHeader
        title="能力首页"
        description="面向新手的场景化 AI 功能入口。每个功能绑定独立工作流，只暴露必要输入。"
      />

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {features.map((feature: any) => (
          <FeatureCard
            key={feature.code}
            code={feature.code}
            name={feature.name}
            description={feature.description}
            resultType={feature.resultType}
          />
        ))}
      </section>

      <section className="mt-6 rounded-3xl border border-white/70 bg-white/90 p-6 shadow-soft">
        <h3 className="text-xl font-semibold text-ink">推荐实现方式</h3>
        <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
          <p>1. 每个功能只暴露少量必要字段，保证新手可直接使用。</p>
          <p>2. 每个功能在后端绑定一个工作流文件，例如 `fenjingtu.json`。</p>
          <p>3. 新增功能时只需要新增工作流和配置，而不是重写整套前端控制台。</p>
        </div>
      </section>
    </div>
  );
}
