import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { FeatureForm } from '@/components/feature-form';
import { getFrontendFeature } from '@/lib/feature-catalog';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

async function getFeature(code: string) {
  try {
    const response = await fetch(`${apiBaseUrl}/features/${code}`, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  }
}

async function getTasks(code: string) {
  try {
    const response = await fetch(`${apiBaseUrl}/tasks`, { cache: 'no-store' });
    if (!response.ok) {
      return [];
    }

    const tasks = await response.json();
    return tasks.filter((task: any) => task.bizType === code);
  } catch {
    return [];
  }
}

export default async function FeaturePage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = await params;
  if (!resolvedParams?.code) {
    notFound();
  }
  const localFeature = getFrontendFeature(resolvedParams.code);
  if (!localFeature) {
    notFound();
  }

  const remoteFeature = await getFeature(resolvedParams.code);
  const feature = {
    ...localFeature,
    ...(remoteFeature || {}),
    fields: Array.isArray(remoteFeature?.fields) ? remoteFeature.fields : localFeature.fields
  };

  const tasks = await getTasks(resolvedParams.code);

  return (
    <div>
      <PageHeader
        title={feature.name}
        description="功能页只暴露少量必要参数，底层使用后端绑定的 ComfyUI 工作流。"
      />
      <FeatureForm feature={feature} initialTasks={tasks} />
    </div>
  );
}
