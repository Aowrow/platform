import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type FeatureField = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'assetImage';
  placeholder?: string;
  required?: boolean;
  description?: string;
  defaultValue?: string;
  options?: Array<{ label: string; value: string }>;
};

export type FeatureDefinition = {
  code: string;
  name: string;
  description: string;
  taskType: string;
  resultType: string;
  workflowFile: string;
  fields: FeatureField[];
  applyInputParams: (workflow: Record<string, any>, inputParams: Record<string, unknown>) => Record<string, any>;
};

function getPromptNode(workflow: Record<string, any>, nodeId: string) {
  const node = workflow[nodeId];

  if (!node || typeof node !== 'object') {
    throw new Error(`Workflow node ${nodeId} not found.`);
  }

  if (!node.inputs || typeof node.inputs !== 'object') {
    throw new Error(`Workflow node ${nodeId} inputs is invalid.`);
  }

  return node;
}

function setNodeInputValue(workflow: Record<string, any>, nodeId: string, inputKey: string, value: string) {
  const node = getPromptNode(workflow, nodeId);
  node.inputs[inputKey] = value;
}

function appendNodeInputValue(workflow: Record<string, any>, nodeId: string, inputKey: string, suffix: string) {
  const node = getPromptNode(workflow, nodeId);
  const currentValue = String(node.inputs[inputKey] || '');
  node.inputs[inputKey] = `${currentValue}${suffix}`;
}

function setProviderConfig(workflow: Record<string, any>, nodeIds: string[]) {
  for (const nodeId of nodeIds) {
    const node = workflow[nodeId];

    if (!node || typeof node !== 'object' || !node.inputs || typeof node.inputs !== 'object') {
      continue;
    }

    if (process.env.COMFYUI_MODEL_API_KEY) {
      node.inputs.api_key = process.env.COMFYUI_MODEL_API_KEY;
    }

    if (process.env.COMFYUI_MODEL_BASE_URL) {
      node.inputs.base_url = process.env.COMFYUI_MODEL_BASE_URL;
    }
  }
}

const featureRegistry: FeatureDefinition[] = [
  {
    code: 'fenjingtu',
    name: '分镜图',
    description: '输入剧情文本后快速生成分镜图，适合不熟悉底层工作流的新手直接使用。',
    taskType: 'image',
    resultType: 'image_group',
    workflowFile: 'fenjingtu3.json',
    fields: [
      {
        key: 'referenceImages',
        label: '参考图片',
        type: 'assetImage',
        required: false,
        description: '可选择一张或多张已上传图片，平台会把图片 URL 注入工作流中的 Load Image URL Batch 节点。'
      },
      {
        key: 'storyText',
        label: '剧情文本',
        type: 'textarea',
        required: true,
        placeholder: '请输入需要拆解成分镜图的剧情内容',
        description: '建议直接填写完整剧情段落，便于工作流拆分镜头。'
      },
      {
        key: 'visualStyle',
        label: '视觉风格',
        type: 'text',
        defaultValue: '电影感、角色统一、镜头连贯、氛围完整',
        placeholder: '例如：古风电影感、冷色调、宿命感'
      },
      {
        key: 'layoutMode',
        label: '分镜布局',
        type: 'select',
        defaultValue: '3x3',
        options: [
          { label: '3 x 3 九宫格', value: '3x3' },
          { label: '5 x 5 二十五宫格', value: '5x5' }
        ]
      },
      {
        key: 'outputRatio',
        label: '输出比例',
        type: 'select',
        defaultValue: '9:16',
        options: [
          { label: '9:16 竖版', value: '9:16' },
          { label: '1:1 方图', value: '1:1' },
          { label: '16:9 横版', value: '16:9' }
        ]
      }
    ],
    applyInputParams(workflow, inputParams) {
      const storyText = String(inputParams.storyText || '');
      const visualStyle = String(inputParams.visualStyle || '电影感、角色统一、镜头连贯、氛围完整');
      const layoutMode = String(inputParams.layoutMode || '3x3');
      const outputRatio = String(inputParams.outputRatio || '9:16');
      const referenceImageUrls = Array.isArray(inputParams.referenceImageUrls)
        ? inputParams.referenceImageUrls.map((item) => String(item)).filter(Boolean)
        : [];
      const storyboardPrompt = `${storyText}\n\n分镜布局：${layoutMode}。请保持角色、服装、场景、光影前后一致。`;
      const finalPromptSuffix = ` 整体视觉风格：${visualStyle}。分镜布局：${layoutMode}。网格长宽比：${outputRatio}。`;

      setNodeInputValue(workflow, '40', 'string_b', storyboardPrompt);
      setNodeInputValue(workflow, '46', 'aspect_ratio', outputRatio);
      setNodeInputValue(workflow, '45', 'filename_prefix', `platform/fenjingtu/${Date.now()}`);
      appendNodeInputValue(workflow, '47', 'string_a', finalPromptSuffix);
      setNodeInputValue(workflow, '58', 'urls', referenceImageUrls.join(';'));
      setProviderConfig(workflow, ['9', '55']);

      return workflow;
    }
  },
  {
    code: 'fenjingtu-splitter',
    name: '分镜图分割',
    description: '输入一张分镜图，按指定行列数做简单分割处理。',
    taskType: 'image',
    resultType: 'image_group',
    workflowFile: 'fenjingtuSplitter.json',
    fields: [
      {
        key: 'referenceImages',
        label: '分镜图图片',
        type: 'assetImage',
        required: true,
        description: '请选择一张已上传的分镜图，平台会把它同步到工作流中的 LoadImage 节点。'
      },
      {
        key: 'rows',
        label: '行数',
        type: 'text',
        defaultValue: '3',
        placeholder: '例如：3'
      },
      {
        key: 'columns',
        label: '列数',
        type: 'text',
        defaultValue: '3',
        placeholder: '例如：3'
      }
    ],
    applyInputParams(workflow, inputParams) {
      const referenceImageUrls = Array.isArray(inputParams.referenceImageUrls)
        ? inputParams.referenceImageUrls.map((item) => String(item)).filter(Boolean)
        : [];
      const rows = Math.max(1, Number(inputParams.rows || 3));
      const columns = Math.max(1, Number(inputParams.columns || 3));

      if (referenceImageUrls.length === 0) {
        throw new Error('fenjingtu-splitter requires at least one reference image URL.');
      }

      setNodeInputValue(workflow, '31', 'url', referenceImageUrls[0]);
      workflow['18'].inputs.rows = rows;
      workflow['18'].inputs.columns = columns;

      return workflow;
    }
  }
];

export function getFeatureDefinitions() {
  return featureRegistry;
}

export function getFeatureDefinition(code: string) {
  return featureRegistry.find((item) => item.code === code);
}

export async function loadFeatureWorkflow(workflowFile: string) {
  const workflowPath = join(process.cwd(), 'workflows', workflowFile);
  const content = await readFile(workflowPath, 'utf-8');
  const parsed = JSON.parse(content) as Record<string, any>;

  if (Array.isArray(parsed.nodes) && Array.isArray(parsed.links)) {
    throw new Error(
      `Workflow file ${workflowFile} is a ComfyUI editor workflow, not API prompt format. Please export the workflow again using API format before binding it to the platform.`
    );
  }

  return parsed;
}
