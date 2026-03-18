export type FrontendFeatureField = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'assetImage';
  placeholder?: string;
  required?: boolean;
  description?: string;
  defaultValue?: string;
  options?: Array<{ label: string; value: string }>;
};

export type FrontendFeature = {
  code: string;
  name: string;
  description: string;
  taskType: string;
  resultType: string;
  fields: FrontendFeatureField[];
};

export const featureCatalog: FrontendFeature[] = [
  {
    code: 'fenjingtu',
    name: '分镜图',
    description: '输入剧情文本后快速生成分镜图，适合不熟悉底层工作流的新手直接使用。',
    taskType: 'image',
    resultType: 'image_group',
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
    ]
  },
  {
    code: 'fenjingtu-splitter',
    name: '分镜图分割',
    description: '输入一张分镜图并设置行列数，快速完成简单分割处理。',
    taskType: 'image',
    resultType: 'image_group',
    fields: [
      {
        key: 'referenceImages',
        label: '分镜图图片',
        type: 'assetImage',
        required: true,
        description: '请选择一张已上传图片，平台会把图片 URL 注入工作流中的 Load Image URL 节点。'
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
    ]
  }
];

export function getFrontendFeature(code: string) {
  return featureCatalog.find((feature) => feature.code === code);
}
